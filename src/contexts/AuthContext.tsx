import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { supabase as supabaseRC } from '../registro-caza/lib/supabase';
import { getPerfil, upsertPerfil, saveSecurityBackup } from '../lib/db';
import type { Perfil } from '../lib/types';

interface AuthContextValue {
  user: User | null;
  perfil: Perfil | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (
    email: string,
    password: string,
    nombreCompleto: string,
    preguntaSeguridad?: string,
    respuestaSeguridadHash?: string,
  ) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshPerfil: () => Promise<void>;
  resetPassword: (email: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadPerfil(u: User) {
    const p = await getPerfil(u.id);
    if (!p) {
      try {
        await upsertPerfil(u.id, {
          nombre_completo: u.user_metadata?.nombre_completo || u.email?.split('@')[0] || '',
          email: u.email || '',
        });
      } catch (catchedError) {
        console.warn('No se pudo crear el perfil automáticamente en este momento:', catchedError);
      }
      const fresh = await getPerfil(u.id);
      setPerfil(fresh);
    } else {
      setPerfil(p);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        (async () => { await loadPerfil(u); setLoading(false); })();
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        (async () => { await loadPerfil(u); })();
      } else {
        setPerfil(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      // También autenticar en Mi Registro de Caza silenciosamente
      supabaseRC.auth.signInWithPassword({ email, password }).catch(() => {
        // Si falla (cuenta no existe aún), intentar registrar
        supabaseRC.auth.signUp({ email, password }).catch(() => {});
      });
    }
    return error?.message ?? null;
  }

  async function signUp(
    email: string,
    password: string,
    nombreCompleto: string,
    preguntaSeguridad?: string,
    respuestaSeguridadHash?: string,
  ): Promise<string | null> {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { nombre_completo: nombreCompleto } },
    });
    if (error) return error.message;
    // También crear cuenta en Mi Registro de Caza
    supabaseRC.auth.signUp({ email, password, options: { data: { nombre_completo: nombreCompleto } } }).catch(() => {});

    if (preguntaSeguridad?.trim() && respuestaSeguridadHash) {
      saveSecurityBackup(email, {
        question: preguntaSeguridad.trim(),
        answerHash: respuestaSeguridadHash,
      });
    }

    if (data.user) {
      try {
        await upsertPerfil(data.user.id, {
          nombre_completo: nombreCompleto,
          email,
          pregunta_seguridad: preguntaSeguridad?.trim() || null,
          respuesta_seguridad_hash: respuestaSeguridadHash || null,
        });
      } catch (catchedError) {
        const code = (catchedError as { code?: string } | null)?.code || '';
        const message = (catchedError as { message?: string } | null)?.message || '';
        const isRlsPendingSession = code === '42501' || /row-level security/i.test(message);
        if (!isRlsPendingSession) {
          return message || 'No se pudo guardar el perfil inicial.';
        }
      }
    }
    return null;
  }

  async function signOut() {
    await supabase.auth.signOut();
    supabaseRC.auth.signOut().catch(() => {});
  }

  async function refreshPerfil() {
    if (user) await loadPerfil(user);
  }

  async function resetPassword(email: string): Promise<string | null> {
    const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/`,
    });
    return error?.message ?? null;
  }

  return (
    <AuthContext.Provider value={{ user, perfil, loading, signIn, signUp, signOut, refreshPerfil, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
