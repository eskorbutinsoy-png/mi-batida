import { useState, useRef } from 'react';
import { ImageIcon, Trash2, Check } from 'lucide-react';
import { configuracionDB } from '../lib/db';
import type { AppConfig } from '../App';

interface Props {
  config: AppConfig;
  reloadConfig: () => void;
  perreraId: string;
}

function saveConfig(perreraId: string, clave: string, valor: string) {
  return configuracionDB.set(perreraId, clave, valor);
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = e => {
      const img = document.createElement('img');
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        // Reducir mas agresivamente para que quepa en localStorage (~5MB limite)
        const maxSize = 600;
        if (width > height) {
          if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; }
        } else {
          if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        // Calidad 0.7 para asegurar que cabe en storage
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function PersonalizacionSection({ config, reloadConfig, perreraId }: Props) {
  const [opacity, setOpacity] = useState(config.bgOpacity);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const img = await resizeImage(file);
      try {
        await saveConfig(perreraId, 'bgImage', img);
      } catch {
        setError('No hay suficiente espacio de almacenamiento. Libera espacio o usa una imagen mas pequena.');
        return;
      }
      reloadConfig();
    } catch {
      setError('Error al procesar la imagen. Prueba con otra foto.');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleSelectImage = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.click();
    }
  };

  const removeBg = async () => {
    await saveConfig(perreraId, 'bgImage', '');
    reloadConfig();
  };

  const saveOpacity = async () => {
    await saveConfig(perreraId, 'bgOpacity', opacity.toString());
    reloadConfig();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 space-y-5">
      <h2 className="text-amber-300 font-bold text-lg">Personalización</h2>

      <div className="bg-black/30 border border-amber-700/20 rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <ImageIcon size={16} className="text-amber-500" />
          <p className="text-amber-300 font-medium text-sm">Fondo de pantalla</p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleFileChange}
        />

        {error && (
          <div className="bg-red-900/40 border border-red-700/50 rounded-xl p-3 text-red-300 text-xs">
            {error}
          </div>
        )}

        {config.bgImage ? (
          <div className="relative">
            <img
              src={config.bgImage}
              className="w-full h-32 object-cover rounded-xl border border-amber-700/30"
              alt="Fondo actual"
            />
            <button
              onClick={removeBg}
              className="absolute top-2 right-2 bg-red-700/80 hover:bg-red-600 text-white p-1.5 rounded-lg transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleSelectImage}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-2 rounded-xl text-sm transition-colors ${
            config.bgImage
              ? 'bg-amber-900/30 hover:bg-amber-900/50 border border-amber-700/30 text-amber-400 py-2.5'
              : 'flex-col h-24 border-2 border-dashed border-amber-700/40 hover:border-amber-500/60 active:bg-amber-900/10 text-amber-700'
          } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <ImageIcon size={config.bgImage ? 15 : 24} className={config.bgImage ? '' : 'mb-1'} />
          <span className={config.bgImage ? '' : 'text-xs'}>
            {loading ? 'Procesando...' : config.bgImage ? 'Cambiar imagen' : 'Seleccionar imagen de fondo'}
          </span>
        </button>

        {config.bgImage && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-amber-600 text-xs">
                Opacidad del oscurecimiento: {Math.round(opacity * 100)}%
              </label>
              {saved && (
                <span className="text-green-400 text-xs flex items-center gap-1">
                  <Check size={12} /> Guardado
                </span>
              )}
            </div>
            <input
              type="range" min="0.1" max="0.95" step="0.05"
              className="w-full accent-amber-500"
              value={opacity}
              onChange={e => setOpacity(parseFloat(e.target.value))}
            />
            <button
              onClick={saveOpacity}
              className="w-full bg-amber-700/40 hover:bg-amber-700/60 text-amber-300 py-2 rounded-lg text-sm transition-colors"
            >
              Guardar opacidad
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
