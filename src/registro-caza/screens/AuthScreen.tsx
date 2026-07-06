import { useState } from 'react';
import { Dog, ArrowRight, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function AuthScreen() {
  const { autoSignIn } = useAuth();
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) { setError('Introduce tu nombre para continuar'); return; }
    setError('');
    setLoading(true);
    const err = await autoSignIn(nombre.trim());
    setLoading(false);
    if (err === 'CONF_EMAIL_REQUIRED') {
      setError('Configuracion pendiente: ve a tu panel de Supabase → Authentication → Providers → Email y desactiva "Confirm email". O activa "Allow anonymous sign-ins".');
    } else if (err) {
      setError(err);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'linear-gradient(135deg, #0a1a05 0%, #1a3a0a 50%, #0d2408 100%)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10 gap-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl bg-amber-900/40 border border-amber-700/50 flex items-center justify-center shadow-2xl">
              <Dog size={46} className="text-amber-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-green-600 border-2 border-[#0a1a05] flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-amber-200 font-bold text-2xl tracking-wide">Mi Registro de Caza</h1>
            <p className="text-amber-600 text-sm mt-1">Gestion completa de tu perrera</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-black/30 border border-amber-700/30 rounded-2xl p-6 space-y-5 shadow-2xl">
          <div className="text-center space-y-1">
            <h2 className="text-amber-200 font-bold text-lg">Bienvenido</h2>
            <p className="text-amber-600 text-sm">Introduce tu nombre para empezar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-amber-500 text-xs font-medium mb-1.5 uppercase tracking-wider">Tu nombre</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-700 pointer-events-none" />
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Juan Garcia"
                  className="w-full bg-black/40 border border-amber-700/40 rounded-xl pl-10 pr-4 py-3.5 text-amber-100 placeholder-amber-800 focus:outline-none focus:border-amber-500 transition-colors text-sm"
                  autoComplete="name"
                  autoFocus
                  maxLength={60}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-900/40 border border-red-700/50 rounded-xl px-4 py-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !nombre.trim()}
              className="w-full flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-amber-100 font-bold py-3.5 rounded-xl transition-all text-sm shadow-lg active:scale-95"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Continuar
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="text-amber-800 text-xs text-center leading-relaxed">
            Tu nombre identifica tu cuenta en la perrera.
            Podras cambiarlo despues desde tu perfil.
          </p>
        </div>
      </div>
    </div>
  );
}
