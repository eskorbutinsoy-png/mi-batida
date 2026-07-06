import { useState, useRef, useEffect } from 'react';
import {
  Camera, X, Check, User, Smartphone,
  Trash2, LogOut, ChevronRight, AlertTriangle, Shield, Key, Eye, EyeOff, Copy
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type View = 'main' | 'delete' | 'set-password';

const DEVICE_EMAIL_KEY = 'mrc_dev_email';
const DEVICE_PASS_KEY = 'mrc_dev_pass';

export default function PerfilSection() {
  const { user, nombreCompleto, reloadPerfil, signOut, perrera, memberEstado, setAccountPassword } = useAuth();
  const [view, setView] = useState<View>('main');

  const [nombre, setNombre] = useState('');
  const [foto, setFoto] = useState('');
  const [loadingPerfil, setLoadingPerfil] = useState(true);
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [perfilMsg, setPerfilMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);

  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [newPass, setNewPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [passMsg, setPassMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);

  const savedEmail = localStorage.getItem(DEVICE_EMAIL_KEY) ?? '';
  const savedPass = localStorage.getItem(DEVICE_PASS_KEY) ?? '';
  const hasCredentials = !!(savedEmail && savedPass);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('perfiles')
      .select('nombre_completo, foto')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setNombre(data.nombre_completo ?? '');
          setFoto(data.foto ?? '');
        }
        setLoadingPerfil(false);
      });
  }, [user]);

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setFoto((ev.target?.result as string) ?? '');
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const savePerfil = async () => {
    if (!user || !nombre.trim()) return;
    setSavingPerfil(true);
    setPerfilMsg(null);
    try {
      const { error } = await supabase.from('perfiles').update({ nombre_completo: nombre.trim(), foto }).eq('id', user.id);
      if (error) throw error;
      setPerfilMsg({ type: 'ok', text: 'Perfil actualizado correctamente' });
      reloadPerfil();
    } catch (e: any) {
      setPerfilMsg({ type: 'err', text: e.message ?? 'Error al guardar' });
    } finally {
      setSavingPerfil(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirm !== 'ELIMINAR') {
      setDeleteMsg({ type: 'err', text: 'Escribe ELIMINAR para confirmar' });
      return;
    }
    setDeletingAccount(true);
    setDeleteMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al eliminar cuenta');
      // Clear device credentials so next launch starts fresh
      localStorage.removeItem('mrc_dev_email');
      localStorage.removeItem('mrc_dev_pass');
      await supabase.auth.signOut();
    } catch (e: any) {
      setDeleteMsg({ type: 'err', text: e.message ?? 'Error al eliminar la cuenta' });
      setDeletingAccount(false);
    }
  };

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newPass) { setPassMsg({ type: 'err', text: 'Introduce email y contraseña' }); return; }
    if (newPass.length < 6) { setPassMsg({ type: 'err', text: 'La contraseña debe tener al menos 6 caracteres' }); return; }
    setSavingPass(true);
    setPassMsg(null);
    const err = await setAccountPassword(newEmail.trim(), newPass);
    setSavingPass(false);
    if (err) {
      setPassMsg({ type: 'err', text: err });
    } else {
      setPassMsg({ type: 'ok', text: 'Credenciales guardadas. Ya puedes acceder con ellas si cierras sesion.' });
      setNewEmail('');
      setNewPass('');
      setView('main');
    }
  };

  const copyText = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const inputCls = "w-full bg-black/40 border border-amber-700/40 rounded-xl px-4 py-3 text-amber-100 text-sm placeholder-amber-800 focus:outline-none focus:border-amber-500 transition-colors";
  const sectionTitle = "text-amber-600 text-xs font-semibold uppercase tracking-widest mb-3 px-1";

  const Msg = ({ msg }: { msg: { type: 'ok' | 'err'; text: string } | null }) =>
    msg ? (
      <div className={`rounded-xl px-4 py-3 text-sm mb-1 ${msg.type === 'ok' ? 'bg-green-900/30 border border-green-700/40 text-green-300' : 'bg-red-900/30 border border-red-700/40 text-red-300'}`}>
        {msg.text}
      </div>
    ) : null;

  if (view === 'set-password') return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => { setView('main'); setPassMsg(null); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-amber-500 hover:bg-amber-900/30 transition-colors">
          <ChevronRight size={18} className="rotate-180" />
        </button>
        <h2 className="text-amber-300 font-bold text-lg">Establecer acceso</h2>
      </div>

      <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-4 text-amber-600 text-xs leading-relaxed">
        Elige un email y contraseña para tu cuenta. Cuando cierres sesion podras volver a entrar desde la opcion <strong className="text-amber-400">"Ya tengo una cuenta"</strong>.
      </div>

      <form onSubmit={handleSetPassword} className="space-y-4">
        <div>
          <label className="block text-amber-600 text-xs mb-1.5 uppercase tracking-wider font-medium">Email</label>
          <input
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            placeholder="tu@email.com"
            autoComplete="email"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-amber-600 text-xs mb-1.5 uppercase tracking-wider font-medium">Contraseña</label>
          <div className="relative">
            <input
              type={showNewPass ? 'text' : 'password'}
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              className={`${inputCls} pr-11`}
            />
            <button type="button" onClick={() => setShowNewPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-700 hover:text-amber-500 transition-colors">
              {showNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <Msg msg={passMsg} />
        <button type="submit" disabled={savingPass} className="w-full bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
          <Key size={15} /> {savingPass ? 'Guardando...' : 'Guardar credenciales'}
        </button>
      </form>
    </div>
  );

  if (view === 'delete') return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => { setView('main'); setDeleteMsg(null); setDeleteConfirm(''); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-amber-500 hover:bg-amber-900/30 transition-colors">
          <ChevronRight size={18} className="rotate-180" />
        </button>
        <h2 className="text-red-400 font-bold text-lg">Eliminar cuenta</h2>
      </div>

      <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
          <AlertTriangle size={16} /> Esta accion es irreversible
        </div>
        <ul className="text-red-300/80 text-xs space-y-1 pl-1">
          <li>• Se eliminaran todos tus datos personales</li>
          <li>• Se perdera el acceso a tu perrera y datos</li>
          <li>• No podras recuperar la cuenta</li>
        </ul>
      </div>

      <div>
        <label className="block text-amber-600 text-xs mb-1.5 uppercase tracking-wider font-medium">
          Escribe <span className="text-red-400 font-bold">ELIMINAR</span> para confirmar
        </label>
        <input
          type="text"
          className={inputCls}
          placeholder="ELIMINAR"
          value={deleteConfirm}
          onChange={e => setDeleteConfirm(e.target.value)}
        />
      </div>

      <Msg msg={deleteMsg} />

      <button
        onClick={deleteAccount}
        disabled={deletingAccount || deleteConfirm !== 'ELIMINAR'}
        className="w-full bg-red-800 hover:bg-red-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        <Trash2 size={15} /> {deletingAccount ? 'Eliminando...' : 'Eliminar mi cuenta definitivamente'}
      </button>
    </div>
  );

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      {loadingPerfil ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Avatar + nombre */}
          <div className="flex flex-col items-center gap-3 pt-2 pb-2">
            <div className="relative">
              {foto ? (
                <img src={foto} className="w-24 h-24 rounded-full object-cover border-2 border-amber-600/50 shadow-xl" alt="" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-amber-800/40 border-2 border-amber-700/40 flex items-center justify-center shadow-xl">
                  <span className="text-3xl font-bold text-amber-200">{nombre?.[0]?.toUpperCase() ?? <User size={30} />}</span>
                </div>
              )}
              {foto && (
                <button onClick={() => setFoto('')} className="absolute -top-1 -right-1 w-6 h-6 bg-red-700 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow">
                  <X size={11} className="text-white" />
                </button>
              )}
            </div>
            <div className="text-center">
              <p className="text-amber-200 font-bold text-lg">{nombreCompleto || nombre || 'Sin nombre'}</p>
              <p className="text-amber-700 text-xs">Cuenta de dispositivo</p>
            </div>
            <button
              type="button"
              onClick={() => fotoRef.current?.click()}
              className="flex items-center gap-2 bg-black/30 border border-amber-700/30 text-amber-500 hover:text-amber-300 px-4 py-2 rounded-xl text-xs transition-colors"
            >
              <Camera size={13} /> {foto ? 'Cambiar foto' : 'Añadir foto'}
            </button>
            <input ref={fotoRef} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
          </div>

          {/* Info de cuenta */}
          <div className="bg-black/20 border border-amber-700/15 rounded-2xl divide-y divide-amber-700/10">
            <div className="flex items-center gap-3 px-4 py-3">
              <Smartphone size={14} className="text-amber-700 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-amber-600 text-[10px] uppercase tracking-wider">Identificacion</p>
                <p className="text-amber-300 text-sm">Cuenta vinculada a este dispositivo</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <Shield size={14} className="text-amber-700 flex-shrink-0" />
              <div>
                <p className="text-amber-600 text-[10px] uppercase tracking-wider">Perrera</p>
                <p className="text-amber-300 text-sm">{perrera?.nombre ?? '—'} <span className="text-amber-700 text-xs ml-1">({memberEstado === 'admin' ? 'Administrador' : 'Miembro'})</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <User size={14} className="text-amber-700 flex-shrink-0" />
              <div>
                <p className="text-amber-600 text-[10px] uppercase tracking-wider">Miembro desde</p>
                <p className="text-amber-300 text-sm">{memberSince}</p>
              </div>
            </div>
          </div>

          {/* Editar nombre */}
          <div>
            <p className={sectionTitle}>Datos del perfil</p>
            <div className="space-y-3">
              <div>
                <label className="block text-amber-600 text-xs mb-1.5 uppercase tracking-wider font-medium">Nombre completo</label>
                <input className={inputCls} placeholder="Tu nombre completo" value={nombre} onChange={e => setNombre(e.target.value)} />
              </div>
              <Msg msg={perfilMsg} />
              <button onClick={savePerfil} disabled={savingPerfil || !nombre.trim()} className="w-full bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                <Check size={15} /> {savingPerfil ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>

          {/* Gestion de cuenta */}
          <div>
            <p className={sectionTitle}>Acceso a tu cuenta</p>
            {hasCredentials ? (
              <div className="bg-black/20 border border-amber-700/15 rounded-2xl p-4 space-y-3">
                <p className="text-amber-600 text-xs leading-relaxed">
                  Tienes credenciales guardadas en este dispositivo. Guardalas en un lugar seguro para poder acceder desde <strong className="text-amber-400">"Ya tengo una cuenta"</strong> si cierras sesion o cambias de dispositivo.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-black/30 rounded-xl px-3 py-2.5">
                    <span className="text-amber-700 text-xs w-14 flex-shrink-0">Email</span>
                    <span className="text-amber-300 text-xs flex-1 truncate font-mono">{savedEmail}</span>
                    <button onClick={() => copyText(savedEmail, setCopiedEmail)} className="text-amber-600 hover:text-amber-400 transition-colors flex-shrink-0">
                      {copiedEmail ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 bg-black/30 rounded-xl px-3 py-2.5">
                    <span className="text-amber-700 text-xs w-14 flex-shrink-0">Clave</span>
                    <span className="text-amber-300 text-xs flex-1 font-mono tracking-widest">••••••••••••</span>
                    <button onClick={() => copyText(savedPass, setCopiedPass)} className="text-amber-600 hover:text-amber-400 transition-colors flex-shrink-0">
                      {copiedPass ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-500 text-xs font-semibold">
                    <AlertTriangle size={14} /> Cuenta de sesion temporal
                  </div>
                  <p className="text-amber-700 text-xs leading-relaxed">
                    Tu cuenta esta vinculada solo a esta sesion. Si cierras sesion no podras recuperar el acceso. Establece una contraseña para poder volver a entrar.
                  </p>
                </div>
                <button
                  onClick={() => { setView('set-password'); setPassMsg(null); }}
                  className="w-full flex items-center gap-3 bg-black/30 border border-amber-600/30 hover:border-amber-500/50 rounded-xl px-4 py-3.5 text-left transition-all"
                >
                  <div className="w-9 h-9 rounded-lg bg-amber-700/20 flex items-center justify-center flex-shrink-0">
                    <Key size={16} className="text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-amber-200 font-medium text-sm">Establecer contraseña</p>
                    <p className="text-amber-700 text-xs">Protege tu acceso para no perderlo</p>
                  </div>
                  <ChevronRight size={16} className="text-amber-700" />
                </button>
              </div>
            )}
          </div>

          {/* Gestion de cuenta */}
          <div>
            <p className={sectionTitle}>Gestion de cuenta</p>
            <div className="space-y-2">
              <button
                onClick={signOut}
                className="w-full flex items-center gap-3 bg-black/30 border border-amber-700/20 hover:border-amber-600/40 rounded-xl px-4 py-3.5 text-left transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                  <LogOut size={16} className="text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="text-amber-200 font-medium text-sm">Cerrar sesion</p>
                  <p className="text-amber-700 text-xs">Salir de la cuenta en este dispositivo</p>
                </div>
                <ChevronRight size={16} className="text-amber-700" />
              </button>

              <button
                onClick={() => { setView('delete'); setDeleteMsg(null); setDeleteConfirm(''); }}
                className="w-full flex items-center gap-3 bg-black/30 border border-red-900/30 hover:border-red-700/50 rounded-xl px-4 py-3.5 text-left transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-red-900/20 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={16} className="text-red-500" />
                </div>
                <div className="flex-1">
                  <p className="text-red-400 font-medium text-sm">Eliminar cuenta</p>
                  <p className="text-red-900 text-xs">Borra permanentemente tu cuenta y datos</p>
                </div>
                <ChevronRight size={16} className="text-red-800" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
