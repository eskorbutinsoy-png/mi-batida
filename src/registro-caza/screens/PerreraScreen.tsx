import { useState } from 'react';
import { PlusCircle, LogIn, Dog, Copy, Check, Users, Clock, UserCheck, UserX, Trash2, LogOut, RefreshCw, Shield, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { PerreraMiembro } from '../contexts/AuthContext';

type View = 'choose' | 'create' | 'join' | 'pending' | 'manage' | 'admin-login';

export default function PerreraScreen() {
  const { perrera, miembros, user, nombreCompleto, fotoPerfil, createPerrera, joinPerrera, approveMembers, rejectMembers, removeMember, reloadPerrera, signOut, signInWithEmail, autoSignIn } = useAuth();

  const [view, setView] = useState<View>(() => {
    if (!perrera) return 'choose';
    return 'manage';
  });

  const [nombre, setNombre] = useState('');
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [codigoJoin, setCodigoJoin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [showPass, setShowPass] = useState(false);

  const isAdmin = perrera?.admin_id === user?.id;
  const isPending = perrera && !isAdmin && miembros.length === 0;

  const pendientes = miembros.filter(m => m.estado === 'pendiente');
  const aprobados = miembros.filter(m => m.estado === 'aprobado');

  const ensureAuth = async (nombre: string): Promise<string | null> => {
    if (user) return null;
    const err = await autoSignIn(nombre.trim() || 'Usuario');
    if (err && err !== 'CONF_EMAIL_REQUIRED') return err;
    return null;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) { setError('Introduce el nombre de la perrera'); return; }
    if (!user && !nombreUsuario.trim()) { setError('Introduce tu nombre'); return; }
    setLoading(true);
    setError('');
    const authErr = await ensureAuth(nombreUsuario);
    if (authErr) { setError(authErr); setLoading(false); return; }
    const err = await createPerrera(nombre.trim());
    setLoading(false);
    if (err) setError(err);
    else setView('manage');
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoJoin.trim()) { setError('Introduce el código de invitación'); return; }
    if (!user && !nombreUsuario.trim()) { setError('Introduce tu nombre'); return; }
    setLoading(true);
    setError('');
    const authErr = await ensureAuth(nombreUsuario);
    if (authErr) { setError(authErr); setLoading(false); return; }
    const err = await joinPerrera(codigoJoin.trim());
    setLoading(false);
    if (err) setError(err);
    else setView('pending');
  };

  const handleCopy = () => {
    if (perrera) {
      navigator.clipboard.writeText(perrera.codigo_invitacion).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await reloadPerrera();
    setRefreshing(false);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPass) { setError('Introduce tu email y contraseña'); return; }
    setLoading(true);
    setError('');
    const err = await signInWithEmail(adminEmail.trim(), adminPass);
    setLoading(false);
    if (err) setError('Email o contraseña incorrectos');
  };

  const handleApprove = async (m: PerreraMiembro) => {
    await approveMembers([m.id]);
  };

  const handleReject = async (m: PerreraMiembro) => {
    await rejectMembers([m.id]);
  };

  const handleRemove = async (m: PerreraMiembro) => {
    await removeMember(m.id);
  };

  // If in pending state (joined but waiting for admin approval)
  if (isPending) {
    return (
      <ScreenWrap onSignOut={signOut} nombre={nombreCompleto} fotoPerfil={fotoPerfil}>
        <div className="flex flex-col items-center text-center py-12 gap-4 px-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-900/30 border border-amber-700/30 flex items-center justify-center">
            <Clock size={32} className="text-amber-500" />
          </div>
          <h2 className="text-amber-200 font-bold text-xl">Solicitud enviada</h2>
          <p className="text-amber-500 text-sm max-w-xs">
            Has solicitado unirte a <span className="text-amber-300 font-semibold">{perrera?.nombre}</span>. El administrador debe aprobar tu solicitud.
          </p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="mt-4 flex items-center gap-2 bg-amber-900/30 border border-amber-700/30 text-amber-400 px-5 py-2.5 rounded-xl text-sm hover:bg-amber-900/50 transition-colors"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            Actualizar estado
          </button>
        </div>
      </ScreenWrap>
    );
  }

  // If admin or approved member — show management panel
  if (perrera && (isAdmin || !isPending)) {
    return (
      <ScreenWrap onSignOut={signOut} nombre={nombreCompleto} fotoPerfil={fotoPerfil}>
        <div className="p-4 space-y-5">
          {/* Perrera info */}
          <div className="bg-black/30 border border-amber-700/20 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Dog size={18} className="text-amber-500" />
              <h2 className="text-amber-200 font-bold text-lg">{perrera.nombre}</h2>
              {isAdmin && <span className="ml-auto text-xs bg-amber-700/40 text-amber-300 px-2 py-0.5 rounded-full">Admin</span>}
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2 bg-black/20 rounded-xl px-3 py-2.5">
                <span className="text-amber-600 text-xs">Código invitación:</span>
                <span className="text-amber-300 font-mono font-bold text-sm tracking-widest flex-1">{perrera.codigo_invitacion}</span>
                <button onClick={handleCopy} className="text-amber-500 hover:text-amber-300 transition-colors">
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            )}
          </div>

          {/* Pending approvals (admin only) */}
          {isAdmin && pendientes.length > 0 && (
            <div className="bg-amber-900/20 border border-amber-600/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-amber-400" />
                <p className="text-amber-300 font-semibold text-sm">{pendientes.length} solicitud{pendientes.length > 1 ? 'es' : ''} pendiente{pendientes.length > 1 ? 's' : ''}</p>
              </div>
              {pendientes.map(m => (
                <div key={m.id} className="flex items-center gap-3 bg-black/20 rounded-xl px-3 py-2.5">
                  <div className="w-8 h-8 rounded-full bg-amber-800/40 flex items-center justify-center text-amber-300 font-bold text-sm">
                    {(m.perfil?.nombre_completo ?? '?')[0]?.toUpperCase()}
                  </div>
                  <span className="flex-1 text-amber-200 text-sm">{m.perfil?.nombre_completo ?? 'Usuario'}</span>
                  <button onClick={() => handleApprove(m)} className="p-1.5 bg-green-800/50 hover:bg-green-700/60 rounded-lg text-green-400 transition-colors">
                    <UserCheck size={15} />
                  </button>
                  <button onClick={() => handleReject(m)} className="p-1.5 bg-red-800/50 hover:bg-red-700/60 rounded-lg text-red-400 transition-colors">
                    <UserX size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Members list */}
          <div className="bg-black/30 border border-amber-700/20 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-amber-500" />
                <p className="text-amber-300 font-semibold text-sm">Miembros aprobados</p>
              </div>
              <button onClick={handleRefresh} disabled={refreshing} className="text-amber-700 hover:text-amber-500 transition-colors">
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              </button>
            </div>
            {/* Admin always shown */}
            <div className="flex items-center gap-3 bg-black/20 rounded-xl px-3 py-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-700/40 flex items-center justify-center text-amber-300 font-bold text-sm">
                {nombreCompleto[0]?.toUpperCase() ?? 'A'}
              </div>
              <span className="flex-1 text-amber-200 text-sm">{isAdmin ? nombreCompleto : (perrera.nombre + ' Admin')}</span>
              <span className="text-xs text-amber-600">Admin</span>
            </div>
            {aprobados.map(m => (
              <div key={m.id} className="flex items-center gap-3 bg-black/20 rounded-xl px-3 py-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-800/40 flex items-center justify-center text-amber-300 font-bold text-sm">
                  {(m.perfil?.nombre_completo ?? '?')[0]?.toUpperCase()}
                </div>
                <span className="flex-1 text-amber-200 text-sm">{m.perfil?.nombre_completo ?? 'Miembro'}</span>
                {isAdmin && (
                  <button onClick={() => handleRemove(m)} className="p-1.5 text-red-600 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            {aprobados.length === 0 && (
              <p className="text-amber-700 text-xs text-center py-2">Solo el administrador por ahora</p>
            )}
          </div>

          <button
            onClick={() => { /* App will use the perrera, close this screen */ window.location.reload(); }}
            className="w-full bg-amber-700 hover:bg-amber-600 text-amber-100 font-bold py-3.5 rounded-xl text-sm transition-colors shadow-lg"
          >
            Entrar a la perrera
          </button>
        </div>
      </ScreenWrap>
    );
  }

  // No perrera yet — choose
  if (view === 'choose') {
    return (
      <ScreenWrap onSignOut={user ? signOut : undefined} nombre={nombreCompleto} fotoPerfil={fotoPerfil}>
        <div className="p-6 space-y-4">
          <div className="text-center py-6">
            <Dog size={48} className="text-amber-500 mx-auto mb-3" />
            <h2 className="text-amber-200 font-bold text-xl">
              {nombreCompleto ? `Bienvenido, ${nombreCompleto.split(' ')[0]}` : 'Mi Registro de Caza'}
            </h2>
            <p className="text-amber-600 text-sm mt-1">Para empezar, crea o únete a una perrera</p>
          </div>

          <button
            onClick={() => { setView('create'); setError(''); }}
            className="w-full flex items-center gap-4 bg-black/30 border border-amber-700/30 hover:border-amber-600/50 rounded-2xl p-5 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-700/30 flex items-center justify-center flex-shrink-0">
              <PlusCircle size={24} className="text-amber-400" />
            </div>
            <div>
              <p className="text-amber-200 font-semibold">Crear perrera</p>
              <p className="text-amber-600 text-xs mt-0.5">Sé el administrador de tu grupo de caza</p>
            </div>
          </button>

          <button
            onClick={() => { setView('join'); setError(''); }}
            className="w-full flex items-center gap-4 bg-black/30 border border-amber-700/30 hover:border-amber-600/50 rounded-2xl p-5 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-700/30 flex items-center justify-center flex-shrink-0">
              <LogIn size={24} className="text-amber-400" />
            </div>
            <div>
              <p className="text-amber-200 font-semibold">Unirse a una perrera</p>
              <p className="text-amber-600 text-xs mt-0.5">Introduce el código de invitación</p>
            </div>
          </button>

          <button
            onClick={() => { setView('admin-login'); setError(''); setAdminEmail(''); setAdminPass(''); }}
            className="w-full flex items-center gap-4 bg-black/30 border border-amber-600/30 hover:border-amber-500/50 rounded-2xl p-5 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-600/20 flex items-center justify-center flex-shrink-0">
              <Shield size={24} className="text-amber-400" />
            </div>
            <div>
              <p className="text-amber-200 font-semibold">Ya tengo una cuenta</p>
              <p className="text-amber-600 text-xs mt-0.5">Accede con tus credenciales guardadas</p>
            </div>
          </button>
        </div>
      </ScreenWrap>
    );
  }

  if (view === 'create') {
    return (
      <ScreenWrap onSignOut={user ? signOut : undefined} nombre={nombreCompleto} fotoPerfil={fotoPerfil} onBack={() => { setView('choose'); setError(''); }}>
        <div className="p-5 space-y-4">
          <h2 className="text-amber-300 font-bold text-lg">Crear perrera</h2>
          <p className="text-amber-600 text-xs">El código de invitación se generará automáticamente.</p>
          <form onSubmit={handleCreate} className="space-y-4">
            {!user && (
              <div>
                <label className="block text-amber-500 text-xs font-medium mb-1.5 uppercase tracking-wider">Tu nombre</label>
                <input
                  type="text"
                  value={nombreUsuario}
                  onChange={e => setNombreUsuario(e.target.value)}
                  placeholder="Ej: Juan García"
                  maxLength={60}
                  className="w-full bg-black/40 border border-amber-700/40 rounded-xl px-4 py-3 text-amber-100 placeholder-amber-800 focus:outline-none focus:border-amber-500 transition-colors text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-amber-500 text-xs font-medium mb-1.5 uppercase tracking-wider">Nombre de la perrera</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Perrera La Sierra"
                className="w-full bg-black/40 border border-amber-700/40 rounded-xl px-4 py-3 text-amber-100 placeholder-amber-800 focus:outline-none focus:border-amber-500 transition-colors text-sm"
              />
            </div>
            {error && <div className="bg-red-900/40 border border-red-700/50 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>}
            <button type="submit" disabled={loading} className="w-full bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-100 font-bold py-3.5 rounded-xl text-sm transition-colors">
              {loading ? 'Creando...' : 'Crear perrera'}
            </button>
          </form>
        </div>
      </ScreenWrap>
    );
  }

  // admin-login
  if (view === 'admin-login') {
    return (
    <ScreenWrap onSignOut={user ? signOut : undefined} nombre={nombreCompleto} onBack={() => { setView('choose'); setError(''); }}>
      <div className="p-5 space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={18} className="text-amber-500" />
            <h2 className="text-amber-300 font-bold text-lg">Ya tengo una cuenta</h2>
          </div>
          <p className="text-amber-600 text-xs">Tanto administradores como miembros con credenciales guardadas pueden acceder aquí.</p>
        </div>
        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label className="block text-amber-500 text-xs font-medium mb-1.5 uppercase tracking-wider">Email</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-700 pointer-events-none" />
              <input
                type="email"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                autoFocus
                className="w-full bg-black/40 border border-amber-700/40 rounded-xl pl-10 pr-4 py-3 text-amber-100 placeholder-amber-800 focus:outline-none focus:border-amber-500 transition-colors text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-amber-500 text-xs font-medium mb-1.5 uppercase tracking-wider">Contraseña</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-700 pointer-events-none" />
              <input
                type={showPass ? 'text' : 'password'}
                value={adminPass}
                onChange={e => setAdminPass(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-black/40 border border-amber-700/40 rounded-xl pl-10 pr-11 py-3 text-amber-100 placeholder-amber-800 focus:outline-none focus:border-amber-500 transition-colors text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-700 hover:text-amber-500 transition-colors"
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          {error && (
            <div className="bg-red-900/40 border border-red-700/50 rounded-xl px-4 py-3 text-red-300 text-sm font-medium">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !adminEmail.trim() || !adminPass}
            className="w-full bg-amber-700 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-amber-100 font-bold py-3.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" /> Entrando...</>
            ) : 'Acceder'}
          </button>
        </form>

        <div className="bg-black/20 border border-amber-700/15 rounded-xl p-4 space-y-1">
          <p className="text-amber-600 text-xs font-semibold uppercase tracking-wider">¿No tienes credenciales?</p>
          <p className="text-amber-700 text-xs leading-relaxed">
            Si eres un miembro nuevo, usa la opcion <strong className="text-amber-500">"Unirse a una perrera"</strong> con el codigo que te dio el admin.
          </p>
        </div>
      </div>
    </ScreenWrap>
    );
  }

  // join
  return (
    <ScreenWrap onSignOut={user ? signOut : undefined} nombre={nombreCompleto} fotoPerfil={fotoPerfil} onBack={() => { setView('choose'); setError(''); }}>
      <div className="p-5 space-y-4">
        <h2 className="text-amber-300 font-bold text-lg">Unirse a una perrera</h2>
        <form onSubmit={handleJoin} className="space-y-4">
          {!user && (
            <div>
              <label className="block text-amber-500 text-xs font-medium mb-1.5 uppercase tracking-wider">Tu nombre</label>
              <input
                type="text"
                value={nombreUsuario}
                onChange={e => setNombreUsuario(e.target.value)}
                placeholder="Ej: Juan García"
                maxLength={60}
                className="w-full bg-black/40 border border-amber-700/40 rounded-xl px-4 py-3 text-amber-100 placeholder-amber-800 focus:outline-none focus:border-amber-500 transition-colors text-sm"
              />
            </div>
          )}
          <div>
            <label className="block text-amber-500 text-xs font-medium mb-1.5 uppercase tracking-wider">Código de invitación</label>
            <input
              type="text"
              value={codigoJoin}
              onChange={e => setCodigoJoin(e.target.value.toUpperCase())}
              placeholder="Ej: CAZA24"
              maxLength={20}
              className="w-full bg-black/40 border border-amber-700/40 rounded-xl px-4 py-3 text-amber-100 placeholder-amber-800 focus:outline-none focus:border-amber-500 transition-colors text-sm font-mono tracking-widest uppercase"
            />
          </div>
          {error && <div className="bg-red-900/40 border border-red-700/50 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>}
          <button type="submit" disabled={loading} className="w-full bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-100 font-bold py-3.5 rounded-xl text-sm transition-colors">
            {loading ? 'Enviando...' : 'Solicitar unirse'}
          </button>
        </form>
      </div>
    </ScreenWrap>
  );
}

function ScreenWrap({ children, onSignOut, nombre, fotoPerfil, onBack }: {
  children: React.ReactNode;
  onSignOut?: () => void;
  nombre: string;
  fotoPerfil?: string;
  onBack?: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0a1a05 0%, #1a3a0a 50%, #0d2408 100%)' }}>
      <header className="sticky top-0 z-50 bg-[#0a1a05]/95 backdrop-blur border-b border-amber-700/30 px-4 py-3 flex items-center gap-3">
        {onBack ? (
          <button onClick={onBack} className="text-amber-500 hover:text-amber-300 transition-colors text-sm">
            ← Volver
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <Dog size={18} className="text-amber-500" />
            <span className="text-amber-300 font-bold text-sm">Mi Registro de Caza</span>
          </div>
        )}
        <div className="flex items-center gap-3 ml-auto">
          {fotoPerfil && (
            <img 
              src={fotoPerfil} 
              alt={nombre} 
              className="w-7 h-7 rounded-full object-cover border border-amber-600/50"
            />
          )}
          {nombre && <span className="text-amber-600 text-xs truncate max-w-24">{nombre.split(' ')[0]}</span>}
          {onSignOut && (
            <button onClick={onSignOut} className="p-1.5 text-amber-700 hover:text-amber-400 transition-colors">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
