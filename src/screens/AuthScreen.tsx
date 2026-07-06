import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getSecurityQuestionByEmail, getSecurityBackup, resetPasswordWithSecurityAnswer } from '../lib/db';
import { hashSecurityAnswer } from '../lib/security';
import { supabase } from '../lib/supabase';
import { TreePine, Eye, EyeOff, Loader2 } from 'lucide-react';

const REMEMBER_CREDENTIALS_KEY = 'mi-batida-remember-credentials';
const AUTH_RATE_LIMIT_PREFIX = 'mi-batida-auth-rate-limit:';
const AUTH_RATE_LIMIT_SECONDS = 90;

type RememberedCredentials = {
  email: string;
  password: string;
};

type AuthAction = 'login' | 'register';

function authRateLimitKey(action: AuthAction, email: string): string {
  return `${AUTH_RATE_LIMIT_PREFIX}${action}:${email.toLowerCase().trim()}`;
}

function getRateLimitRemainingMs(action: AuthAction, email: string): number {
  try {
    const raw = localStorage.getItem(authRateLimitKey(action, email));
    if (!raw) return 0;
    const until = Number(raw);
    if (!Number.isFinite(until)) return 0;
    const remaining = until - Date.now();
    return remaining > 0 ? remaining : 0;
  } catch {
    return 0;
  }
}

function setRateLimitCooldown(action: AuthAction, email: string, seconds: number): void {
  try {
    const until = Date.now() + (seconds * 1000);
    localStorage.setItem(authRateLimitKey(action, email), String(until));
  } catch {
    /* ignore */
  }
}

function isRateLimitMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes('rate limit')
    || normalized.includes('too many requests')
    || normalized.includes('over_email_send_rate_limit')
    || normalized.includes('email rate limit exceeded');
}

function formatRetryAfter(remainingMs: number): string {
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
  return `${seconds}s`;
}

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'reset' | 'change_password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [preguntaSeguridad, setPreguntaSeguridad] = useState('');
  const [respuestaSeguridad, setRespuestaSeguridad] = useState('');
  const [securityQuestionForReset, setSecurityQuestionForReset] = useState<string | null>(null);
  const [securityAnswerForReset, setSecurityAnswerForReset] = useState('');
  const [newPasswordForReset, setNewPasswordForReset] = useState('');
  const [confirmPasswordForReset, setConfirmPasswordForReset] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmNewPwd, setShowConfirmNewPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [rememberCredentials, setRememberCredentials] = useState(false);

  const clearErrorIfAny = () => {
    if (error) setError('');
  };

  const resetRecoveryState = () => {
    setSecurityQuestionForReset(null);
    setSecurityAnswerForReset('');
    setNewPasswordForReset('');
    setConfirmPasswordForReset('');
  };

  // Detectar si hay un token de recuperación en la URL
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('access_token') && hash.includes('type=recovery')) {
      setMode('change_password');
      // Limpiar el hash de la URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Cargar credenciales guardadas para autocompletar inicio de sesión.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_CREDENTIALS_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved) as RememberedCredentials;
      if (parsed.email && parsed.password) {
        setEmail(parsed.email);
        setPassword(parsed.password);
        setRememberCredentials(true);
      }
    } catch (catchedError) {
      console.error('No se pudieron cargar las credenciales recordadas:', catchedError);
      localStorage.removeItem(REMEMBER_CREDENTIALS_KEY);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    const cleanEmail = email.toLowerCase().trim();
    const cleanNombre = nombre.trim();
    const action: AuthAction = mode === 'register' ? 'register' : 'login';

    const remainingMs = getRateLimitRemainingMs(action, cleanEmail);
    if (remainingMs > 0) {
      setError(`Demasiados intentos para este correo. Espera ${formatRetryAfter(remainingMs)} y vuelve a intentarlo.`);
      setLoading(false);
      return;
    }

    try {
      let err: string | null = null;

      if (mode === 'login') {
        err = await signIn(cleanEmail, password);
        if (!err) {
          if (rememberCredentials) {
            const credentialsToRemember: RememberedCredentials = {
              email: cleanEmail,
              password,
            };
            localStorage.setItem(REMEMBER_CREDENTIALS_KEY, JSON.stringify(credentialsToRemember));
          } else {
            localStorage.removeItem(REMEMBER_CREDENTIALS_KEY);
          }
        }
      } else {
        if (!cleanNombre) {
          setError('Introduce tu nombre');
          setLoading(false);
          return;
        }
        if (!preguntaSeguridad.trim() || !respuestaSeguridad.trim()) {
          setError('Configura pregunta y respuesta de seguridad para poder recuperar tu contraseña.');
          setLoading(false);
          return;
        }
        const answerHash = await hashSecurityAnswer(respuestaSeguridad);
        err = await signUp(cleanEmail, password, cleanNombre, preguntaSeguridad.trim(), answerHash);
        if (!err) {
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            setError('Cuenta creada. Si no entras automáticamente, revisa tu correo y confirma tu cuenta antes de iniciar sesión.');
            setMode('login');
            setPassword('');
          }
        }
      }

      if (err) {
        if (isRateLimitMessage(err)) {
          setRateLimitCooldown(action, cleanEmail, AUTH_RATE_LIMIT_SECONDS);
          setError(`Has llegado al límite de intentos para este correo. Espera ${AUTH_RATE_LIMIT_SECONDS}s antes de volver a probar.`);
        } else {
          setError(err);
        }
      }
    } catch (catchedError) {
      console.error('Error en el flujo de autenticación:', catchedError);
      setError('Ocurrió un error inesperado. Comprueba tu conexión a internet.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');

    const cleanEmail = email.toLowerCase().trim();

    if (!cleanEmail) {
      setError('Introduce tu email.');
      return;
    }

    setLoading(true);

    try {
      if (!securityQuestionForReset) {
        const question = await getSecurityQuestionByEmail(cleanEmail);
        if (!question) {
          setError('No se encontró pregunta de seguridad para este email.');
          setLoading(false);
          return;
        }
        setSecurityQuestionForReset(question);
      } else {
        if (!securityAnswerForReset.trim()) {
          setError('Responde tu pregunta de seguridad.');
          setLoading(false);
          return;
        }
        if (newPasswordForReset.length < 6) {
          setError('La nueva contraseña debe tener al menos 6 caracteres.');
          setLoading(false);
          return;
        }
        if (newPasswordForReset !== confirmPasswordForReset) {
          setError('Las contraseñas no coinciden.');
          setLoading(false);
          return;
        }

        const answerHash = await hashSecurityAnswer(securityAnswerForReset);
        const result = await resetPasswordWithSecurityAnswer(cleanEmail, answerHash, newPasswordForReset);
        if (!result.ok) {
          if (result.reason === 'wrong_answer') {
            setError('Respuesta incorrecta o no se pudo cambiar la contraseña.');
          } else if (result.reason === 'server_not_ready') {
            const localBackup = getSecurityBackup(cleanEmail);
            if (localBackup?.answerHash === answerHash) {
              setError('La respuesta es correcta, pero la recuperación no está activada en el servidor. Falta aplicar la migración de Supabase.');
            } else {
              setError('El servidor de recuperación no está listo todavía. Intenta de nuevo en unos segundos.');
            }
          } else {
            setError('No se pudo cambiar la contraseña por un error del servidor. Inténtalo de nuevo.');
          }
          setLoading(false);
          return;
        }

        setResetSent(true);
        setTimeout(() => {
          setResetSent(false);
          setMode('login');
          setEmail('');
          resetRecoveryState();
        }, 2200);
      }
    } catch (catchedError) {
      console.error('Error:', catchedError);
      setError('Ocurrió un error. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        setError(error.message);
      } else {
        // Éxito - mostrar mensaje y redirigir a login
        setResetSent(true);
        setTimeout(() => {
          setResetSent(false);
          setMode('login');
          setNewPassword('');
          setConfirmPassword('');
        }, 3000);
      }
    } catch (catchedError) {
      console.error('Error:', catchedError);
      setError('Ocurrió un error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest via-forest-dark to-forest flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Logo & Branding */}
        <div className="flex flex-col items-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-br from-amber to-amber-light rounded-3xl flex items-center justify-center mb-4 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-amber/20 animate-pulse"></div>
            <TreePine className="w-11 h-11 text-forest-dark relative z-10" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter">Mi Gestión de Caza</h1>
          <p className="text-forest-light text-base mt-2 font-medium">Gestión profesional de batidas de caza</p>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-3xl p-8 shadow-2xl border border-forest-border/30 backdrop-blur-sm">
          {mode !== 'reset' && mode !== 'change_password' && (
            <div className="flex rounded-2xl bg-forest-dark/60 p-1.5 mb-8 border border-forest-border/30">
              <button
                type="button"
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${mode === 'login' ? 'bg-amber text-forest-dark shadow-lg' : 'text-forest-light hover:text-amber'}`}
                onClick={() => {
                  setMode('login');
                  setError('');
                  resetRecoveryState();
                }}
              >
                Entrar
              </button>
              <button
                type="button"
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${mode === 'register' ? 'bg-amber text-forest-dark shadow-lg' : 'text-forest-light hover:text-amber'}`}
                onClick={() => {
                  setMode('register');
                  setError('');
                  resetRecoveryState();
                }}
              >
                Registrarse
              </button>
            </div>
          )}

          {mode === 'change_password' && (
            <div className="mb-8 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-amber/20 rounded-2xl mb-4">
                <TreePine className="w-6 h-6 text-amber" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Cambiar contraseña</h2>
              <p className="text-forest-light text-sm">Ingresa tu nueva contraseña para acceder</p>
            </div>
          )}

          <form onSubmit={mode === 'reset' ? handlePasswordReset : mode === 'change_password' ? handleChangePassword : handleSubmit} className="space-y-5" noValidate>
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs text-forest-light font-bold mb-2.5 uppercase tracking-wide">Nombre completo</label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={e => {
                      setNombre(e.target.value);
                      clearErrorIfAny();
                    }}
                    placeholder="Juan García"
                    autoComplete="name"
                    className="w-full bg-forest-dark border-2 border-forest-border rounded-2xl px-4 py-3.5 text-white placeholder-forest-muted text-sm outline-none focus:border-amber focus:bg-forest-dark/50 transition-all duration-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-forest-light font-bold mb-2.5 uppercase tracking-wide">Pregunta para recuperar contraseña</label>
                  <input
                    type="text"
                    value={preguntaSeguridad}
                    onChange={e => {
                      setPreguntaSeguridad(e.target.value);
                      clearErrorIfAny();
                    }}
                    placeholder="Ej: Nombre de mi primer perro"
                    className="w-full bg-forest-dark border-2 border-forest-border rounded-2xl px-4 py-3.5 text-white placeholder-forest-muted text-sm outline-none focus:border-amber focus:bg-forest-dark/50 transition-all duration-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-forest-light font-bold mb-2.5 uppercase tracking-wide">Respuesta para recuperar contraseña</label>
                  <input
                    type="text"
                    value={respuestaSeguridad}
                    onChange={e => {
                      setRespuestaSeguridad(e.target.value);
                      clearErrorIfAny();
                    }}
                    placeholder="Solo tú la sabes"
                    className="w-full bg-forest-dark border-2 border-forest-border rounded-2xl px-4 py-3.5 text-white placeholder-forest-muted text-sm outline-none focus:border-amber focus:bg-forest-dark/50 transition-all duration-200"
                    required
                  />
                </div>
              </>
            )}

            {(mode === 'login' || mode === 'register') && (
              <div>
                <label className="block text-xs text-forest-light font-bold mb-2.5 uppercase tracking-wide">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    clearErrorIfAny();
                  }}
                  placeholder="cazador@email.com"
                  autoComplete="email"
                  autoCapitalize="none"
                  className="w-full bg-forest-dark border-2 border-forest-border rounded-2xl px-4 py-3.5 text-white placeholder-forest-muted text-sm outline-none focus:border-amber focus:bg-forest-dark/50 transition-all duration-200"
                  required
                />
              </div>
            )}

            {mode === 'reset' && (
              <>
                <div>
                  <label className="block text-xs text-forest-light font-bold mb-2.5 uppercase tracking-wide">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value);
                      clearErrorIfAny();
                    }}
                    placeholder="cazador@email.com"
                    autoComplete="email"
                    autoCapitalize="none"
                    className="w-full bg-forest-dark border-2 border-forest-border rounded-2xl px-4 py-3.5 text-white placeholder-forest-muted text-sm outline-none focus:border-amber focus:bg-forest-dark/50 transition-all duration-200"
                    required
                    disabled={!!securityQuestionForReset}
                  />
                </div>

                {securityQuestionForReset && (
                  <>
                    <div>
                      <label className="block text-xs text-forest-light font-bold mb-2.5 uppercase tracking-wide">Tu pregunta de recuperación</label>
                      <div className="w-full bg-forest-dark/60 border-2 border-forest-border rounded-2xl px-4 py-3.5 text-white text-sm">
                        {securityQuestionForReset}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-forest-light font-bold mb-2.5 uppercase tracking-wide">Respuesta de recuperación</label>
                      <input
                        type="text"
                        value={securityAnswerForReset}
                        onChange={e => {
                          setSecurityAnswerForReset(e.target.value);
                          clearErrorIfAny();
                        }}
                        placeholder="Tu respuesta"
                        className="w-full bg-forest-dark border-2 border-forest-border rounded-2xl px-4 py-3.5 text-white placeholder-forest-muted text-sm outline-none focus:border-amber focus:bg-forest-dark/50 transition-all duration-200"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-forest-light font-bold mb-2.5 uppercase tracking-wide">Nueva contraseña</label>
                      <div className="relative group">
                        <input
                          type={showNewPwd ? 'text' : 'password'}
                          value={newPasswordForReset}
                          onChange={e => {
                            setNewPasswordForReset(e.target.value);
                            clearErrorIfAny();
                          }}
                          placeholder="••••••••"
                          className="w-full bg-forest-dark border-2 border-forest-border rounded-2xl px-4 py-3.5 pr-12 text-white placeholder-forest-muted text-sm outline-none focus:border-amber focus:bg-forest-dark/50 transition-all duration-200"
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPwd(!showNewPwd)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-forest-muted hover:text-amber transition-colors"
                        >
                          {showNewPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-forest-light font-bold mb-2.5 uppercase tracking-wide">Confirmar nueva contraseña</label>
                      <div className="relative group">
                        <input
                          type={showConfirmNewPwd ? 'text' : 'password'}
                          value={confirmPasswordForReset}
                          onChange={e => {
                            setConfirmPasswordForReset(e.target.value);
                            clearErrorIfAny();
                          }}
                          placeholder="••••••••"
                          className="w-full bg-forest-dark border-2 border-forest-border rounded-2xl px-4 py-3.5 pr-12 text-white placeholder-forest-muted text-sm outline-none focus:border-amber focus:bg-forest-dark/50 transition-all duration-200"
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmNewPwd(!showConfirmNewPwd)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-forest-muted hover:text-amber transition-colors"
                        >
                          {showConfirmNewPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {(mode === 'login' || mode === 'register') && (
              <div>
                <label className="block text-xs text-forest-light font-bold mb-2.5 uppercase tracking-wide">Contraseña</label>
                <div className="relative group">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value);
                      clearErrorIfAny();
                    }}
                    placeholder="••••••••"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="w-full bg-forest-dark border-2 border-forest-border rounded-2xl px-4 py-3.5 pr-12 text-white placeholder-forest-muted text-sm outline-none focus:border-amber focus:bg-forest-dark/50 transition-all duration-200"
                    required
                    minLength={6}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-forest-muted hover:text-amber transition-colors"
                  >
                    {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'login' && (
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberCredentials}
                  onChange={e => setRememberCredentials(e.target.checked)}
                  className="h-4 w-4 rounded border-2 border-forest-border bg-forest-dark text-amber focus:ring-amber focus:ring-2"
                />
                <span className="text-sm text-forest-light font-medium">Recordar usuario y contraseña</span>
              </label>
            )}

            {mode === 'change_password' && (
              <>
                <div>
                  <label className="block text-xs text-forest-light font-bold mb-2.5 uppercase tracking-wide">Nueva contraseña</label>
                  <div className="relative group">
                    <input
                      type={showNewPwd ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => {
                        setNewPassword(e.target.value);
                        clearErrorIfAny();
                      }}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="w-full bg-forest-dark border-2 border-forest-border rounded-2xl px-4 py-3.5 pr-12 text-white placeholder-forest-muted text-sm outline-none focus:border-amber focus:bg-forest-dark/50 transition-all duration-200"
                      required
                      minLength={6}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowNewPwd(!showNewPwd)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-forest-muted hover:text-amber transition-colors"
                    >
                      {showNewPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-forest-light font-bold mb-2.5 uppercase tracking-wide">Confirmar contraseña</label>
                  <div className="relative group">
                    <input
                      type={showConfirmNewPwd ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => {
                        setConfirmPassword(e.target.value);
                        clearErrorIfAny();
                      }}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="w-full bg-forest-dark border-2 border-forest-border rounded-2xl px-4 py-3.5 pr-12 text-white placeholder-forest-muted text-sm outline-none focus:border-amber focus:bg-forest-dark/50 transition-all duration-200"
                      required
                      minLength={6}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowConfirmNewPwd(!showConfirmNewPwd)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-forest-muted hover:text-amber transition-colors"
                    >
                      {showConfirmNewPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="bg-red-900/40 border-2 border-red-600/60 rounded-2xl px-4 py-3 text-red-300 text-sm font-medium backdrop-blur-sm">
                <div className="flex gap-2">
                  <span className="text-lg">⚠️</span>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {resetSent && (
              <div className="bg-green-900/40 border-2 border-green-600/60 rounded-2xl px-4 py-3 text-green-300 text-sm font-medium backdrop-blur-sm">
                <div className="flex gap-2">
                  <span className="text-lg">✓</span>
                  <span>{mode === 'change_password' ? 'Contraseña cambiada exitosamente. Redirigiendo...' : 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.'}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber to-amber-light hover:from-amber-light hover:to-amber text-forest-dark font-bold py-4 rounded-2xl transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-3 mt-6 shadow-xl"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              <span className="text-lg">
                {mode === 'login' ? 'Entrar' : mode === 'register' ? 'Crear cuenta' : mode === 'change_password' ? 'Cambiar contraseña' : (securityQuestionForReset ? 'Cambiar contraseña' : 'Continuar')}
              </span>
            </button>

            {mode === 'login' && (
              <div className="space-y-3">
                <p className="text-xs text-forest-light/80 leading-relaxed text-center">
                  Primero verás tu pregunta de recuperación y después podrás poner una nueva contraseña desde la app.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMode('reset');
                    setError('');
                    resetRecoveryState();
                  }}
                  className="w-full text-amber hover:text-amber-light text-sm font-semibold py-3 transition-colors border-t border-forest-border/30 mt-4 pt-4"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setEmail('');
                  setError('');
                  resetRecoveryState();
                }}
                className="w-full text-amber hover:text-amber-light text-sm font-semibold py-3 transition-colors border-t border-forest-border/30 mt-4 pt-4"
              >
                Volver a iniciar sesión
              </button>
            )}

            {mode === 'change_password' && (
              <button
                type="button"
                onClick={() => { setMode('login'); setNewPassword(''); setConfirmPassword(''); setError(''); }}
                className="w-full text-amber hover:text-amber-light text-sm font-semibold py-3 transition-colors border-t border-forest-border/30 mt-4 pt-4"
              >
                Volver a iniciar sesión
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}