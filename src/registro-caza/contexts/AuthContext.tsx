import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface Perrera {
  id: string;
  nombre: string;
  codigo_invitacion: string;
  admin_id: string;
  created_at: string;
}

export interface PerreraMiembro {
  id: string;
  perrera_id: string;
  user_id: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  created_at: string;
  perfil?: { nombre_completo: string; id: string };
}

interface AuthState {
  session: Session | null;
  user: User | null;
  nombreCompleto: string;
  fotoPerfil: string;
  perrera: Perrera | null;
  miembros: PerreraMiembro[];
  memberEstado: 'admin' | 'aprobado' | 'pendiente' | null;
  loading: boolean;
  perreraLoading: boolean;
}

interface AuthContextValue extends AuthState {
  autoSignIn: (nombre: string) => Promise<string | null>;
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  setAccountPassword: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  createPerrera: (nombre: string) => Promise<string | null>;
  joinPerrera: (codigo: string) => Promise<string | null>;
  approveMembers: (ids: string[]) => Promise<void>;
  rejectMembers: (ids: string[]) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  reloadPerrera: () => Promise<void>;
  reloadPerfil: () => Promise<void>;
}

const DEVICE_EMAIL_KEY = 'mrc_dev_email';
const DEVICE_PASS_KEY = 'mrc_dev_pass';

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    nombreCompleto: '',
    fotoPerfil: '',
    perrera: null,
    miembros: [],
    memberEstado: null,
    loading: true,
    perreraLoading: false,
  });

  const loadPerrera = useCallback(async (userId: string) => {
    setState(s => ({ ...s, perreraLoading: true }));
    try {
      const [{ data: adminPerrera }, { data: memberships }] = await Promise.all([
        supabase.from('perreras').select('*').eq('admin_id', userId).maybeSingle(),
        supabase.from('perrera_miembros').select('*, perrera:perreras(*)').eq('user_id', userId).order('created_at', { ascending: false }),
      ]);

      if (adminPerrera) {
        const { data: rawMiembros } = await supabase
          .from('perrera_miembros')
          .select('*')
          .eq('perrera_id', adminPerrera.id)
          .order('created_at', { ascending: true });

        const memberIds = (rawMiembros ?? []).map(m => m.user_id);
        const { data: profilesData } = memberIds.length > 0
          ? await supabase.from('perfiles').select('id, nombre_completo').in('id', memberIds)
          : { data: [] };

        const profileMap = new Map((profilesData ?? []).map(p => [p.id, p]));
        const miembros = (rawMiembros ?? []).map(m => ({
          ...m,
          perfil: profileMap.get(m.user_id) ?? undefined,
        }));

        setState(s => ({
          ...s,
          perrera: adminPerrera as Perrera,
          miembros: miembros as PerreraMiembro[],
          memberEstado: 'admin',
          perreraLoading: false,
        }));
        return;
      }

      const approved = (memberships ?? []).find(m => m.estado === 'aprobado');
      if (approved?.perrera) {
        setState(s => ({
          ...s,
          perrera: approved.perrera as Perrera,
          miembros: [],
          memberEstado: 'aprobado',
          perreraLoading: false,
        }));
        return;
      }

      const pending = (memberships ?? []).find(m => m.estado === 'pendiente');
      if (pending?.perrera) {
        setState(s => ({
          ...s,
          perrera: pending.perrera as Perrera,
          miembros: [],
          memberEstado: 'pendiente',
          perreraLoading: false,
        }));
        return;
      }

      setState(s => ({ ...s, perrera: null, miembros: [], memberEstado: null, perreraLoading: false }));
    } catch {
      setState(s => ({ ...s, perreraLoading: false }));
    }
  }, []);

  const loadNombre = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('perfiles')
      .select('nombre_completo, foto')
      .eq('id', userId)
      .maybeSingle();
    if (data) setState(s => ({ ...s, nombreCompleto: data.nombre_completo, fotoPerfil: data.foto ?? '' }));
  }, []);

  const reloadPerfil = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await loadNombre(user.id);
  }, [loadNombre]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;

      if (!session) {
        // Auto-sign-in with stored device credentials (returning users without active session)
        const storedEmail = localStorage.getItem(DEVICE_EMAIL_KEY);
        const storedPass = localStorage.getItem(DEVICE_PASS_KEY);
        if (storedEmail && storedPass) {
          const { error } = await supabase.auth.signInWithPassword({ email: storedEmail, password: storedPass });
          if (error) {
            localStorage.removeItem(DEVICE_EMAIL_KEY);
            localStorage.removeItem(DEVICE_PASS_KEY);
          }
          // onAuthStateChange will handle the SIGNED_IN event
          if (!mounted) return;
        }
      }

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!mounted) return;
      setState(s => ({ ...s, session: currentSession, user: currentSession?.user ?? null, loading: false }));
      if (currentSession?.user) {
        loadNombre(currentSession.user.id);
        loadPerrera(currentSession.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setState(s => ({ ...s, session, user: session?.user ?? null, loading: false }));
      if (session?.user) {
        loadNombre(session.user.id);
        // TOKEN_REFRESHED fires on background restore — skip perrera reload to avoid navigation reset
        if (event !== 'TOKEN_REFRESHED') {
          loadPerrera(session.user.id);
        }
      } else {
        setState(s => ({ ...s, perrera: null, miembros: [], memberEstado: null, nombreCompleto: '', fotoPerfil: '' }));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadPerrera, loadNombre]);

  // Creates a device-bound session transparently — no email/password UX shown to the user.
  // Tries anonymous sign-in first (no email required). Falls back to email-based signup.
  const autoSignIn = async (nombre: string): Promise<string | null> => {
    // Reuse stored device credentials if available
    const storedEmail = localStorage.getItem(DEVICE_EMAIL_KEY);
    const storedPass = localStorage.getItem(DEVICE_PASS_KEY);

    if (storedEmail && storedPass) {
      const { error } = await supabase.auth.signInWithPassword({ email: storedEmail, password: storedPass });
      if (!error) return null;
      localStorage.removeItem(DEVICE_EMAIL_KEY);
      localStorage.removeItem(DEVICE_PASS_KEY);
    }

    // Try anonymous sign-in (requires "Allow anonymous sign-ins" enabled in Supabase dashboard)
    const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously({
      options: { data: { nombre_completo: nombre.trim() } },
    });
    if (!anonError && anonData.user) return null;

    // If anonymous sign-in is disabled, create an email-based account.
    // Requires "Confirm email" to be DISABLED in Supabase Auth > Providers > Email.
    const uid = crypto.randomUUID().replace(/-/g, '');
    const newEmail = `u${uid.slice(0, 16)}@mrc.app`;
    const newPass = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');

    const { error } = await supabase.auth.signUp({
      email: newEmail,
      password: newPass,
      options: { data: { nombre_completo: nombre.trim() } },
    });

    if (error) {
      if (error.message.includes('confirmation email') || error.message.includes('sending')) {
        return 'CONF_EMAIL_REQUIRED';
      }
      return error.message;
    }

    localStorage.setItem(DEVICE_EMAIL_KEY, newEmail);
    localStorage.setItem(DEVICE_PASS_KEY, newPass);
    return null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const signInWithEmail = async (email: string, password: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return error.message;
    if (data.session && data.user) {
      setState(s => ({ ...s, session: data.session, user: data.user, loading: false }));
      loadNombre(data.user.id);
      loadPerrera(data.user.id);
    }
    return null;
  };

  const setAccountPassword = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.updateUser({ email: email.trim(), password });
    if (error) return error.message;
    localStorage.setItem(DEVICE_EMAIL_KEY, email.trim());
    localStorage.setItem(DEVICE_PASS_KEY, password);
    return null;
  };

  const createPerrera = async (nombre: string) => {
    const { data: { user: liveUser } } = await supabase.auth.getUser();
    if (!liveUser) return 'No autenticado';
    const codigo = Math.random().toString(36).slice(2, 7).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
    const { data, error } = await supabase
      .from('perreras')
      .insert({ nombre, codigo_invitacion: codigo, admin_id: liveUser.id })
      .select()
      .single();
    if (error) return error.message;
    setState(s => ({ ...s, perrera: data as Perrera, memberEstado: 'admin' }));
    return null;
  };

  const joinPerrera = async (codigo: string) => {
    const { data: { user: liveUser } } = await supabase.auth.getUser();
    if (!liveUser) return 'No autenticado';
    const clean = codigo.trim().toUpperCase();

    // Use RPC to bypass PostgREST schema cache issues
    const { data: rows, error: pe } = await supabase.rpc('find_perrera_by_code', { p_codigo: clean });
    if (pe) return `Error al buscar perrera: ${pe.message}`;
    const perrera = rows?.[0] ?? null;
    if (!perrera) return `Código "${clean}" no encontrado. Comprueba que está escrito correctamente.`;

    if (perrera.admin_id === liveUser.id) {
      // User is the admin of this perrera — restore their state directly
      setState(s => ({ ...s, perrera: perrera as Perrera, memberEstado: 'admin' }));
      return null;
    }

    const { error } = await supabase
      .from('perrera_miembros')
      .insert({ perrera_id: perrera.id, user_id: liveUser.id, estado: 'pendiente' });
    if (error) {
      if (error.code === '23505') return 'Ya has solicitado unirte a esta perrera';
      return error.message;
    }
    setState(s => ({ ...s, perrera: perrera as Perrera, memberEstado: 'pendiente' }));
    return null;
  };

  const approveMembers = async (ids: string[]) => {
    await supabase.from('perrera_miembros').update({ estado: 'aprobado' }).in('id', ids);
    if (state.user) await loadPerrera(state.user.id);
  };

  const rejectMembers = async (ids: string[]) => {
    await supabase.from('perrera_miembros').update({ estado: 'rechazado' }).in('id', ids);
    if (state.user) await loadPerrera(state.user.id);
  };

  const removeMember = async (id: string) => {
    await supabase.from('perrera_miembros').delete().eq('id', id);
    if (state.user) await loadPerrera(state.user.id);
  };

  const reloadPerrera = async () => {
    if (state.user) await loadPerrera(state.user.id);
  };

  return (
    <AuthContext.Provider value={{ ...state, autoSignIn, signInWithEmail, setAccountPassword, signOut, createPerrera, joinPerrera, approveMembers, rejectMembers, removeMember, reloadPerrera, reloadPerfil }}>
      {children}
    </AuthContext.Provider>
  );
}
