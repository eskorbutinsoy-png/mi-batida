import { useState, useRef } from 'react';
import {
  Archive, Download, Upload, AlertTriangle, Check, FolderOpen,
  Database, ArrowRight
} from 'lucide-react';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { exportBackup } from '../lib/storage';
import { supabase } from '../lib/supabase';

interface Props {
  onRestore: () => void;
  perreraId?: string;
}

const isNative = () => Capacitor.isNativePlatform();

type Msg = { type: 'ok' | 'error' | 'info'; text: string };

export default function CopiasSection({ onRestore, perreraId }: Props) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<Msg | null>(null);
  const [migrando, setMigrando] = useState(false);
  const [migProgress, setMigProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportar = async () => {
    setExporting(true);
    setMessage(null);
    try {
      const json = exportBackup();
      const fileName = `caza_backup_${new Date().toISOString().split('T')[0]}.json`;

      if (isNative()) {
        await Filesystem.writeFile({ path: fileName, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
        const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
        const canShare = await Share.canShare();
        if (canShare.value) {
          await Share.share({ title: 'Copia de seguridad', text: `Backup ${new Date().toLocaleDateString('es-ES')}`, url: uri, dialogTitle: 'Guardar copia' });
        } else {
          await Filesystem.writeFile({ path: fileName, data: json, directory: Directory.Documents, encoding: Encoding.UTF8 });
          setMessage({ type: 'ok', text: `Guardado en Documentos: ${fileName}` });
          return;
        }
        setMessage({ type: 'ok', text: 'Copia exportada correctamente.' });
      } else {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName; a.click();
        URL.revokeObjectURL(url);
        setMessage({ type: 'ok', text: 'Copia exportada correctamente.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: `Error al exportar: ${err?.message ?? 'error desconocido'}` });
    } finally {
      setExporting(false);
    }
  };

  const migrarASupabase = async (data: any) => {
    if (!perreraId) {
      setMessage({ type: 'error', text: 'No hay perrera activa. Entra a tu perrera primero.' });
      return;
    }
    if (!confirm('¿Importar la copia de seguridad a la perrera en la nube?\n\nSe añadirán los datos del archivo. Los datos existentes no se borrarán.')) return;

    setMigrando(true);
    setMessage(null);

    const extractArray = (source: any, key: string): any[] => {
      if (source.localStorage) {
        try { return JSON.parse(source.localStorage[key] ?? '[]') ?? []; } catch { return []; }
      }
      return Array.isArray(source[key]) ? source[key] : [];
    };

    let ok = 0;
    let fail = 0;

    const insertBatch = async (table: string, rows: any[]) => {
      if (!rows.length) return;
      setMigProgress(`Importando ${table} (${rows.length})...`);
      const prepared = rows.map(r => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { created_at, updated_at, ...rest } = r as any;
        return { ...rest, perrera_id: perreraId };
      });
      const chunkSize = 50;
      for (let i = 0; i < prepared.length; i += chunkSize) {
        const { error } = await supabase.from(table).upsert(prepared.slice(i, i + chunkSize), { ignoreDuplicates: true });
        if (error) {
          fail += prepared.slice(i, i + chunkSize).length;
          console.warn(table, error.message);
        } else {
          ok += prepared.slice(i, i + chunkSize).length;
        }
      }
    };

    try {
      await insertBatch('perros', extractArray(data, 'perros'));
      await insertBatch('perro_historial', extractArray(data, 'perros_historial'));
      await insertBatch('cacerias', extractArray(data, 'cacerias'));
      await insertBatch('caceria_animales', extractArray(data, 'caceria_animales'));
      await insertBatch('caceria_perros', extractArray(data, 'caceria_perros'));
      await insertBatch('caceria_perro_especies', extractArray(data, 'caceria_perro_especies'));
      await insertBatch('salud', extractArray(data, 'salud'));
      await insertBatch('gps_puntos', extractArray(data, 'gps_puntos'));
      await insertBatch('rastreos', extractArray(data, 'rastreos'));
      await insertBatch('rastreo_puntos', extractArray(data, 'rastreo_puntos'));
      await insertBatch('telefonos', extractArray(data, 'telefonos'));
      await insertBatch('cronometros', extractArray(data, 'cronometros'));
      await insertBatch('collares_gps', extractArray(data, 'collares_gps'));
      await insertBatch('gastos', extractArray(data, 'gastos'));

      setMessage({
        type: fail === 0 ? 'ok' : 'info',
        text: fail === 0
          ? `Importacion completada. ${ok} registros cargados en la nube.`
          : `Importacion parcial. ${ok} cargados, ${fail} omitidos (posibles duplicados).`,
      });
      onRestore();
    } catch (err: any) {
      setMessage({ type: 'error', text: `Error en la importacion: ${err?.message ?? 'error desconocido'}` });
    } finally {
      setMigrando(false);
      setMigProgress('');
    }
  };

  const importarDesdeArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setMessage(null);
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      setImporting(false);
      if (e.target) e.target.value = '';
      await migrarASupabase(raw);
    } catch {
      setMessage({ type: 'error', text: 'Error al leer el archivo. Verifica que sea un JSON valido.' });
      setImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  const msgCls = (type: Msg['type']) =>
    type === 'ok'
      ? 'bg-green-900/30 border-green-600/40 text-green-300'
      : type === 'info'
      ? 'bg-blue-900/30 border-blue-600/40 text-blue-300'
      : 'bg-red-900/30 border-red-600/40 text-red-300';

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-amber-300 font-bold text-lg">Copias de Seguridad</h2>

      {message && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${msgCls(message.type)}`}>
          {message.type === 'ok'
            ? <Check size={18} className="flex-shrink-0 mt-0.5" />
            : <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {migrando && (
        <div className="flex items-center gap-3 p-4 rounded-xl border bg-amber-900/20 border-amber-600/30 text-amber-300">
          <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span className="text-sm">{migProgress || 'Migrando datos...'}</span>
        </div>
      )}

      <div className="space-y-3">
        {/* Exportar */}
        <div className="bg-black/30 border border-amber-700/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-900/30 border border-green-700/30 flex items-center justify-center">
              <Download size={18} className="text-green-400" />
            </div>
            <div>
              <p className="text-amber-200 font-medium text-sm">Exportar Copia</p>
              <p className="text-amber-700 text-xs">
                {isNative() ? 'Guarda o comparte el backup' : 'Descarga todos tus datos como JSON'}
              </p>
            </div>
          </div>
          <button
            onClick={exportar}
            disabled={exporting}
            className="w-full bg-green-800/50 hover:bg-green-700/50 border border-green-600/40 text-green-300 py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isNative() ? <FolderOpen size={16} /> : <Archive size={16} />}
            {exporting ? 'Exportando...' : isNative() ? 'Exportar y elegir destino' : 'Exportar Backup JSON'}
          </button>
        </div>

        {/* Importar */}
        <div className="bg-black/30 border border-amber-700/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-900/30 border border-amber-700/30 flex items-center justify-center">
              <Upload size={18} className="text-amber-400" />
            </div>
            <div>
              <p className="text-amber-200 font-medium text-sm">Importar Copia</p>
              <p className="text-amber-700 text-xs">Compatible con backups del sistema antiguo</p>
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 flex items-start gap-2">
            <Database size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-blue-300 text-xs leading-relaxed">
              Si tienes una copia guardada del sistema anterior, cargala aqui y se migrara automaticamente a tu perrera en la nube.
            </p>
          </div>

          <label className={`w-full flex items-center justify-center gap-2 bg-amber-700/40 hover:bg-amber-700/60 border border-amber-600/40 text-amber-300 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer ${(importing || migrando) ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload size={16} />
            {importing || migrando ? 'Procesando...' : 'Seleccionar archivo JSON'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={importarDesdeArchivo}
              disabled={importing || migrando}
            />
          </label>

          {isNative() && (
            <p className="text-amber-800 text-xs text-center">
              El archivo debe estar en Descargas, Drive o accesible desde el gestor de archivos
            </p>
          )}
        </div>

        <div className="bg-black/20 border border-amber-700/10 rounded-xl p-3 flex items-start gap-2">
          <ArrowRight size={14} className="text-amber-700 flex-shrink-0 mt-0.5" />
          <p className="text-amber-700 text-xs leading-relaxed">
            Los backups antiguos (antes de la sincronizacion) se detectan automaticamente y sus datos se importan a tu perrera sin borrar lo que ya tienes.
          </p>
        </div>
      </div>
    </div>
  );
}
