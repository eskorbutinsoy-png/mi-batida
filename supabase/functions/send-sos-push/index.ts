import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RequestBody = {
  batidaId?: string;
  senderUserId?: string;
  message?: string;
  lat?: number | null;
  lng?: number | null;
};

type ServiceAccount = {
  project_id: string;
  private_key: string;
  client_email: string;
};

function toServiceAccount(maybe: unknown): ServiceAccount | null {
  if (!maybe || typeof maybe !== 'object') return null;
  const obj = maybe as Partial<ServiceAccount>;
  if (!obj.project_id || !obj.private_key || !obj.client_email) return null;
  return {
    project_id: obj.project_id,
    private_key: obj.private_key,
    client_email: obj.client_email,
  };
}

function parseServiceAccountSecret(raw: string): ServiceAccount | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const candidates: string[] = [trimmed];
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    candidates.push(trimmed.slice(1, -1));
  }

  for (const c of candidates) {
    try {
      const first = JSON.parse(c) as unknown;
      const obj = typeof first === 'string' ? JSON.parse(first) as unknown : first;
      const sa = toServiceAccount(obj);
      if (sa) return sa;
    } catch {
      // keep trying with other shapes
    }
  }

  return null;
}

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function decodeBase64Utf8(input: string): string {
  const bytes = Uint8Array.from(atob(input), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function getFcmV1AccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedJwt = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  );

  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsignedJwt),
  );

  const signedJwt = `${unsignedJwt}.${base64UrlEncode(new Uint8Array(signatureBuffer))}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    }),
  });

  if (!tokenRes.ok) {
    const txt = await tokenRes.text().catch(() => '');
    throw new Error(`Failed to obtain Google OAuth token: ${tokenRes.status} ${txt}`);
  }

  const tokenJson = await tokenRes.json();
  const accessToken = tokenJson?.access_token;
  if (!accessToken || typeof accessToken !== 'string') {
    throw new Error('Google OAuth token response missing access_token');
  }
  return accessToken;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const fcmServerKey = Deno.env.get('FCM_SERVER_KEY') || '';
    const fcmServiceAccountJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON') || '';
    const fcmProjectId = Deno.env.get('FCM_PROJECT_ID') || '';
    const fcmClientEmail = Deno.env.get('FCM_CLIENT_EMAIL') || '';
    const fcmPrivateKeyB64 = Deno.env.get('FCM_PRIVATE_KEY_B64') || '';

    let serviceAccount: ServiceAccount | null = null;

    if (fcmProjectId && fcmClientEmail && fcmPrivateKeyB64) {
      try {
        serviceAccount = {
          project_id: fcmProjectId,
          client_email: fcmClientEmail,
          private_key: decodeBase64Utf8(fcmPrivateKeyB64),
        };
      } catch {
        return json(500, { error: 'Invalid FCM_PRIVATE_KEY_B64 (base64 decode failed)' });
      }
    }

    if (fcmServiceAccountJson) {
      const parsed = parseServiceAccountSecret(fcmServiceAccountJson);
      if (parsed) {
        serviceAccount = parsed;
      } else if (!serviceAccount) {
        return json(500, { error: 'Invalid FCM_SERVICE_ACCOUNT_JSON (must contain project_id, client_email, private_key)' });
      }
    }

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return json(500, { error: 'Missing env vars: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY' });
    }

    if (!fcmServerKey && !serviceAccount) {
      return json(500, { error: 'Missing FCM credentials: set FCM_SERVER_KEY (legacy) or FCM_SERVICE_ACCOUNT_JSON (v1)' });
    }

    const authHeader = req.headers.get('Authorization') || '';
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: callerAuth, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerAuth?.user) {
      return json(401, { error: 'Unauthorized' });
    }

    const body = (await req.json()) as RequestBody;
    const batidaId = body.batidaId?.trim();
    const senderUserId = body.senderUserId?.trim();
    const message = body.message?.trim();

    if (!batidaId || !senderUserId || !message) {
      return json(400, { error: 'batidaId, senderUserId and message are required' });
    }

    if (callerAuth.user.id !== senderUserId) {
      return json(403, { error: 'Forbidden: sender mismatch' });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: members, error: membersError } = await adminClient
      .from('batida_miembros')
      .select('user_id, estado')
      .eq('batida_id', batidaId)
      .eq('estado', 'activo');

    if (membersError) {
      return json(500, { error: membersError.message });
    }

    const recipientUserIds = Array.from(
      new Set((members || []).map((m) => m.user_id).filter((id) => id && id !== senderUserId)),
    );

    if (recipientUserIds.length === 0) {
      return json(200, { ok: true, sent: 0, reason: 'no recipients' });
    }

    const { data: tokenRows, error: tokenError } = await adminClient
      .from('push_device_tokens')
      .select('token')
      .in('user_id', recipientUserIds)
      .eq('enabled', true);

    if (tokenError) {
      return json(500, { error: tokenError.message });
    }

    const tokens = Array.from(new Set((tokenRows || []).map((r) => r.token).filter(Boolean)));

    if (tokens.length === 0) {
      return json(200, { ok: true, sent: 0, reason: 'no tokens' });
    }

    const title = '🚨 SOS de seguridad';
    const bodyText = 'Se ha recibido una alerta SOS en tu batida.';

    let sent = 0;
    const invalidTokens: string[] = [];
    let failed = 0;
    const failedSamples: string[] = [];

    if (serviceAccount) {
      const accessToken = await getFcmV1AccessToken(serviceAccount);
      const endpoint = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

      for (const token of tokens) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token,
              notification: {
                title,
                body: bodyText,
              },
              data: {
                type: 'sos',
                batidaId,
                senderUserId,
                lat: typeof body.lat === 'number' ? String(body.lat) : '',
                lng: typeof body.lng === 'number' ? String(body.lng) : '',
                message,
              },
              android: {
                priority: 'high',
                notification: {
                  channel_id: 'sos-alerts-v3',
                  default_sound: true,
                  sound: 'default',
                },
              },
            },
          }),
        });

        if (response.ok) {
          sent += 1;
          continue;
        }

        const errPayload = await response.json().catch(() => ({}));
        const errText = JSON.stringify(errPayload).toLowerCase();
        if (errText.includes('registration-token-not-registered') || errText.includes('invalid argument')) {
          invalidTokens.push(token);
        }
        failed += 1;
        if (failedSamples.length < 3) failedSamples.push(errText.slice(0, 240));
      }
    } else {
      for (const tokenChunk of chunk(tokens, 900)) {
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `key=${fcmServerKey}`,
          },
          body: JSON.stringify({
            priority: 'high',
            registration_ids: tokenChunk,
            android_channel_id: 'sos-alerts-v3',
            notification: {
              title,
              body: bodyText,
              default_sound: true,
              sound: 'default',
            },
            data: {
              type: 'sos',
              batidaId,
              senderUserId,
              lat: typeof body.lat === 'number' ? String(body.lat) : '',
              lng: typeof body.lng === 'number' ? String(body.lng) : '',
              message,
            },
          }),
        });

        const payload = await response.json().catch(() => ({}));
        const results = Array.isArray(payload?.results) ? payload.results : [];
        sent += Number(payload?.success || 0);
        failed += Number(payload?.failure || 0);

        results.forEach((r: { error?: string }, idx: number) => {
          if (!r?.error) return;
          if (r.error === 'NotRegistered' || r.error === 'InvalidRegistration') {
            const tk = tokenChunk[idx];
            if (tk) invalidTokens.push(tk);
          }
          if (failedSamples.length < 3) failedSamples.push(String(r.error));
        });
      }
    }

    if (invalidTokens.length > 0) {
      await adminClient.from('push_device_tokens').delete().in('token', invalidTokens);
    }

    return json(200, {
      ok: true,
      requested: tokens.length,
      sent,
      failed,
      failedSamples,
      invalidRemoved: invalidTokens.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json(500, { error: message });
  }
});
