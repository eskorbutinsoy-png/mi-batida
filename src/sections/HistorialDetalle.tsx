import { useEffect, useState, useMemo, useCallback } from 'react';
import type {
  Batida,
  BatidaMiembro,
  BatidaRegistro,
  BatidaRastro,
  BatidaAlerta,
  BatidaMensaje,
  BatidaPuestoMapa,
} from '../lib/types';
import { getEspecieLabel, getEspecieEmoji, TIPO_REGISTRO_LABELS, normalizeEspecieRegistro } from '../lib/types';
import { getRegistros, getBatidaMiembros, getRastros, getAlertasPerro, getMensajes, getPuestosMapa } from '../lib/db';
import { supabase } from '../lib/supabase';
import { ChevronLeft, ChevronDown, ChevronUp, Download, Loader2, MessageCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface Props {
  batida: Batida;
  onClose: () => void;
}

export default function HistorialDetalle({ batida, onClose }: Props) {
  const [registros, setRegistros] = useState<BatidaRegistro[]>([]);
  const [miembros, setMiembros] = useState<BatidaMiembro[]>([]);
  const [rastros, setRastros] = useState<BatidaRastro[]>([]);
  const [alertas, setAlertas] = useState<BatidaAlerta[]>([]);
  const [mensajes, setMensajes] = useState<BatidaMensaje[]>([]);
  const [puestos, setPuestos] = useState<BatidaPuestoMapa[]>([]);
  const [expandedUids, setExpandedUids] = useState<Set<string>>(new Set());
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfAction, setPdfAction] = useState<'download' | 'whatsapp' | null>(null);

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const base64 = result.includes(',') ? result.split(',')[1] : '';
        if (!base64) {
          reject(new Error('No se pudo convertir el PDF a base64.'));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error || new Error('Error leyendo el PDF.'));
      reader.readAsDataURL(blob);
    });
  }

  const load = useCallback(async () => {
    const [r, m, ra, al, me, pu] = await Promise.all([
      getRegistros(batida.id),
      getBatidaMiembros(batida.id),
      getRastros(batida.id),
      getAlertasPerro(batida.id),
      getMensajes(batida.id),
      getPuestosMapa(batida.id),
    ]);
    setRegistros(r);
    setMiembros(m);
    setRastros(ra);
    setAlertas(al);
    setMensajes(me);
    setPuestos(pu);
  }, [batida.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel(`registros-detalle-${batida.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batida_registros', filter: `batida_id=eq.${batida.id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batida_rastros', filter: `batida_id=eq.${batida.id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batida_alertas', filter: `batida_id=eq.${batida.id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batida_chat_mensajes', filter: `batida_id=eq.${batida.id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batida_puestos_mapa', filter: `batida_id=eq.${batida.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [batida.id, load]);

  const memberMap = useMemo(() => new Map(miembros.map(m => [m.user_id, m])), [miembros]);

  const byPerson = useMemo(() => {
    const map = new Map<string, { nombre: string; puesto: string; entries: BatidaRegistro[]; porEspecie: Record<string, { cazado: number; herido: number; escapado: number }> }>();
    for (const r of registros) {
      if (!map.has(r.user_id)) {
        const m = memberMap.get(r.user_id);
        map.set(r.user_id, {
          nombre: m?.perfil?.nombre_completo || 'Desconocido',
          puesto: m?.tipo === 'perrero' ? 'Perrero' : (`Postura${m?.puesto_nombre ? ' · ' + m.puesto_nombre : ''}`),
          entries: [],
          porEspecie: {},
        });
      }
      const person = map.get(r.user_id)!;
      person.entries.push(r);
      const especieKey = normalizeEspecieRegistro(r.especie);
      if (!person.porEspecie[especieKey]) person.porEspecie[especieKey] = { cazado: 0, herido: 0, escapado: 0 };
      person.porEspecie[especieKey][r.tipo_registro as 'cazado' | 'herido' | 'escapado']++;
    }
    return map;
  }, [registros, memberMap]);

  const timelineRows = useMemo(() => {
    const rows: Array<{ id: string; ts: number; hhmm: string; tipo: string; actor: string; detalle: string }> = [];

    registros.forEach((r) => {
      const m = memberMap.get(r.user_id);
      const actor = m?.perfil?.nombre_completo || 'Desconocido';
      rows.push({
        id: `reg-${r.id}`,
        ts: new Date(r.created_at).getTime(),
        hhmm: new Date(r.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        tipo: 'REGISTRO',
        actor,
        detalle: `${TIPO_REGISTRO_LABELS[r.tipo_registro]} · ${getEspecieLabel(r.especie)}${r.raza ? ` · ${r.raza}` : ''}${r.notas ? ` · ${r.notas}` : ''}`,
      });
    });

    mensajes
      .filter((msg) => typeof msg.mensaje === 'string' && msg.mensaje.includes('SOS DE SEGURIDAD'))
      .forEach((msg) => {
        const m = memberMap.get(msg.user_id);
        const actor = msg.perfil?.nombre_completo || m?.perfil?.nombre_completo || 'Desconocido';
        rows.push({
          id: `sos-${msg.id}`,
          ts: new Date(msg.created_at).getTime(),
          hhmm: new Date(msg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          tipo: 'SOS',
          actor,
          detalle: (msg.mensaje || '').replace(/\n/g, ' · ').slice(0, 220),
        });
      });

    alertas.forEach((a) => {
      const m = memberMap.get(a.user_id);
      const actor = a.perfil?.nombre_completo || m?.perfil?.nombre_completo || 'Desconocido';
      rows.push({
        id: `alt-${a.id}`,
        ts: new Date(a.created_at).getTime(),
        hhmm: new Date(a.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        tipo: 'ALERTA',
        actor,
        detalle: `${a.tipo_alerta}${a.raza ? ` · ${a.raza}` : ''}${a.color ? ` · ${a.color}` : ''}${a.direccion ? ` · ${a.direccion}` : ''}${a.mensaje ? ` · ${a.mensaje}` : ''}`,
      });
    });

    rastros.forEach((r) => {
      const m = memberMap.get(r.user_id);
      const actor = m?.perfil?.nombre_completo || 'Desconocido';
      rows.push({
        id: `ras-${r.id}`,
        ts: new Date(r.created_at).getTime(),
        hhmm: new Date(r.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        tipo: 'RASTRO',
        actor,
        detalle: `${r.especie} · ${r.antiguedad} · dir ${r.direccion}`,
      });
    });

    puestos.forEach((p) => {
      rows.push({
        id: `pue-${p.id}`,
        ts: new Date(p.created_at).getTime(),
        hhmm: new Date(p.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        tipo: 'PUESTO',
        actor: 'Sistema',
        detalle: `${p.nombre} · ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`,
      });
    });

    return rows.sort((a, b) => b.ts - a.ts);
  }, [registros, mensajes, alertas, rastros, puestos, memberMap]);

  function toggleExpand(uid: string) {
    setExpandedUids((prev) => {
      const n = new Set(prev);
      if (n.has(uid)) {
        n.delete(uid);
      } else {
        n.add(uid);
      }
      return n;
    });
  }

  async function buildPdf(): Promise<{ filename: string; pdfBlob: Blob }> {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    const title = `Informe de Batida - ${batida.nombre}`;
    doc.setFontSize(16);
    doc.text(title, 40, 40);

    doc.setFontSize(10);
    doc.text(`Estado: ${batida.estado}`, 40, 60);
    doc.text(`Inicio: ${new Date(batida.created_at).toLocaleString('es-ES')}`, 40, 74);
    doc.text(`Fin: ${batida.finalizada_at ? new Date(batida.finalizada_at).toLocaleString('es-ES') : 'En curso'}`, 40, 88);

    const resumenPorUsuarioEspecie: Array<[string, string, number, number, number]> = [];
    Array.from(byPerson.values()).forEach((person) => {
      Object.entries(person.porEspecie).forEach(([esp, cnt]) => {
        resumenPorUsuarioEspecie.push([
          person.nombre,
          getEspecieLabel(esp),
          cnt.cazado,
          cnt.herido,
          cnt.escapado,
        ]);
      });
    });

    autoTable(doc, {
      startY: 106,
      head: [['Usuario', 'Especie', 'Cazado', 'Herido', 'Escapado']],
      body: resumenPorUsuarioEspecie.length > 0 ? resumenPorUsuarioEspecie : [['-', '-', 0, 0, 0]],
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
    });

    const afterResumenY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 130;
    doc.setFontSize(12);
    doc.text('Cronologia completa', 40, afterResumenY + 20);

    const chronoRows = timelineRows.map((row) => [row.hhmm, row.tipo, row.actor, row.detalle.slice(0, 220)]);
    autoTable(doc, {
      startY: afterResumenY + 28,
      head: [['Hora', 'Tipo', 'Actor', 'Detalle']],
      body: chronoRows.length > 0 ? chronoRows : [['-', '-', '-', 'Sin actividad']],
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: 40, right: 40 },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 70 },
        2: { cellWidth: 120 },
        3: { cellWidth: pageWidth - 40 - 40 - 45 - 70 - 120 },
      },
    });

    const slug = batida.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const filename = `informe-batida-${slug || 'batida'}.pdf`;
    const pdfBlob = doc.output('blob');

    return { filename, pdfBlob };
  }

  async function triggerBrowserDownload(pdfBlob: Blob, filename: string): Promise<void> {
    const pickerApi = (window as Window & {
      showSaveFilePicker?: (options: any) => Promise<any>;
    }).showSaveFilePicker;

    if (pickerApi) {
      try {
        const fileHandle = await pickerApi({
          suggestedName: filename,
          types: [
            {
              description: 'Documento PDF',
              accept: { 'application/pdf': ['.pdf'] },
            },
          ],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(pdfBlob);
        await writable.close();
        alert(`PDF guardado en ${fileHandle.name}.`);
        return;
      } catch (pickerError) {
        if ((pickerError as { name?: string })?.name === 'AbortError') {
          return;
        }
        console.warn('No se pudo usar el selector de guardado del navegador:', pickerError);
      }
    }

    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    alert(`PDF descargado como ${filename}. Si el navegador no preguntó carpeta, revisa Descargas.`);
  }

  async function handlePdfAction(action: 'download' | 'whatsapp') {
    if (pdfLoading) return;
    setPdfLoading(true);
    setPdfAction(action);
    try {
      const { filename, pdfBlob } = await buildPdf();

      if (Capacitor.isNativePlatform()) {
        const base64 = await blobToBase64(pdfBlob);
        const path = `MiBatida/${filename}`;
        const saved = await Filesystem.writeFile({
          path,
          data: base64,
          directory: Directory.Documents,
          recursive: true,
        });

        if (action === 'whatsapp') {
          await Share.share({
            title: 'Informe de batida',
            text: `Informe generado: ${filename}`,
            url: saved.uri,
            dialogTitle: 'Enviar PDF por WhatsApp',
          });
          return;
        }

        alert(`PDF guardado en la app.\nRuta: ${path}`);
        return;
      }

      await triggerBrowserDownload(pdfBlob, filename);
      if (action === 'whatsapp') {
        const text = encodeURIComponent(`Te envio el informe de batida: ${filename}`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
        alert('En navegador no se puede adjuntar el PDF automáticamente a WhatsApp. Se ha descargado el PDF para que lo adjuntes manualmente.');
      }
    } catch (error) {
      console.error('Error al generar PDF:', error);
      alert('No se pudo generar el PDF. Intenta de nuevo.');
    } finally {
      setPdfLoading(false);
      setPdfAction(null);
    }
  }

  async function handleDownloadPdf() {
    await handlePdfAction('download');
  }

  async function handleSharePdfWhatsApp() {
    await handlePdfAction('whatsapp');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-gradient-to-b from-forest-dark to-forest-dark/90 rounded-3xl border-2 border-amber/30 p-6 overflow-y-auto max-h-[90vh] shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-forest-border">
          <button onClick={onClose} className="text-amber hover:text-amber-light transition-colors p-2 -ml-2 rounded-lg hover:bg-forest-hover">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h3 className="text-white font-black text-xl">📊 {batida.nombre}</h3>
            <p className="text-amber text-xs font-medium mt-1">{new Date(batida.created_at).toLocaleDateString('es-ES')} · {registros.length} registros totales</p>
          </div>
          {batida.estado === 'finalizada' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
                className="h-10 px-3 rounded-xl border-2 border-amber/50 text-amber hover:border-amber hover:bg-amber/10 font-black text-xs transition-all flex items-center gap-2 disabled:opacity-60"
              >
                {pdfLoading && pdfAction === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Descargar PDF
              </button>
              <button
                onClick={handleSharePdfWhatsApp}
                disabled={pdfLoading}
                className="h-10 px-3 rounded-xl border-2 border-green-500/60 text-green-300 hover:border-green-400 hover:bg-green-500/10 font-black text-xs transition-all flex items-center gap-2 disabled:opacity-60"
              >
                {pdfLoading && pdfAction === 'whatsapp' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                WhatsApp PDF
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-forest/70 border-2 border-forest-border rounded-2xl p-4">
            <p className="text-forest-muted text-[11px] font-black uppercase">Inicio</p>
            <p className="text-white font-bold mt-1">{new Date(batida.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <div className="bg-forest/70 border-2 border-forest-border rounded-2xl p-4">
            <p className="text-forest-muted text-[11px] font-black uppercase">Finalización</p>
            <p className="text-white font-bold mt-1">{batida.finalizada_at ? new Date(batida.finalizada_at).toLocaleString('es-ES', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'En curso'}</p>
          </div>
        </div>

        <div className="mb-6 bg-gradient-to-br from-forest-dark/80 to-forest-dark/60 border-2 border-forest-border rounded-2xl p-4">
          <h4 className="text-white font-black text-sm uppercase tracking-wide mb-3">Transcripcion completa (hora:min)</h4>
          {timelineRows.length === 0 ? (
            <p className="text-forest-muted text-sm">Sin actividad registrada.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {timelineRows.slice(0, 260).map((row) => (
                <div key={row.id} className="flex gap-3 bg-forest-dark/70 border-2 border-forest-border rounded-xl px-3 py-2.5 items-start">
                  <div className="w-14 shrink-0 text-amber text-xs font-black">{row.hhmm}</div>
                  <div className="shrink-0 text-[10px] font-black px-2 py-0.5 rounded-md bg-forest border border-forest-border text-forest-light">{row.tipo}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-bold truncate">{row.actor}</p>
                    <p className="text-forest-muted text-xs mt-1 break-words">{row.detalle}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {byPerson.size === 0 && (
          <p className="text-forest-muted text-center py-12 font-medium">Sin registros en esta batida</p>
        )}

        <div className="space-y-3">
          {Array.from(byPerson.entries()).map(([uid, { nombre, puesto, entries, porEspecie }]) => {
            const expanded = expandedUids.has(uid);
            const cazados = entries.filter(e => e.tipo_registro === 'cazado').length;
            const heridos = entries.filter(e => e.tipo_registro === 'herido').length;
            const escapados = entries.filter(e => e.tipo_registro === 'escapado').length;
            return (
              <div key={uid} className="bg-gradient-to-r from-forest-dark to-forest-dark/70 border-2 border-forest-border hover:border-amber/40 rounded-2xl overflow-hidden transition-all">
                <button onClick={() => toggleExpand(uid)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-forest-dark/50 transition-all text-left">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-base font-black">{nombre}</p>
                    <p className="text-amber text-xs font-medium mt-1">{puesto}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="flex gap-2.5 text-xs font-black">
                      {cazados > 0 && <span className="bg-green-900/40 text-green-300 border-2 border-green-700/40 px-2.5 py-1 rounded-lg">{cazados} 🟢</span>}
                      {heridos > 0 && <span className="bg-orange-900/40 text-orange-300 border-2 border-orange-700/40 px-2.5 py-1 rounded-lg">{heridos} 🟠</span>}
                      {escapados > 0 && <span className="bg-gray-800/40 text-gray-400 border-2 border-gray-700/40 px-2.5 py-1 rounded-lg">{escapados} ⚪</span>}
                      {entries.length === 0 && <span className="text-forest-muted italic">Sin registros</span>}
                    </div>
                    {expanded ? <ChevronUp className="w-5 h-5 text-amber" /> : <ChevronDown className="w-5 h-5 text-forest-muted" />}
                  </div>
                </button>

                {expanded && (
                  <div className="border-t-2 border-forest-border bg-forest/30">
                    {/* Resumen por especie */}
                    {Object.keys(porEspecie).length > 0 && (
                      <div className="px-5 py-4 space-y-3 border-b-2 border-forest-border">
                        {Object.entries(porEspecie).map(([esp, cnt]) => (
                          <div key={esp} className="flex items-center gap-3">
                            <span className="text-2xl w-6 text-center">{getEspecieEmoji(esp)}</span>
                            <span className="text-white text-sm font-bold flex-1">{getEspecieLabel(esp)}</span>
                            <div className="flex gap-2 text-xs font-black">
                              {cnt.cazado > 0 && <span className="text-green-300 bg-green-900/40 border-2 border-green-700/40 px-2.5 py-1 rounded-lg">{cnt.cazado}</span>}
                              {cnt.herido > 0 && <span className="text-orange-300 bg-orange-900/40 border-2 border-orange-700/40 px-2.5 py-1 rounded-lg">{cnt.herido}</span>}
                              {cnt.escapado > 0 && <span className="text-gray-400 bg-gray-800/40 border-2 border-gray-700/40 px-2.5 py-1 rounded-lg">{cnt.escapado}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Detalle individual */}
                    <div className="px-5 py-4 space-y-2.5">
                      {entries.map(r => (
                        <div key={r.id} className="flex items-center gap-3 text-sm py-2 px-3 bg-forest rounded-xl">
                          <span className="text-amber font-black text-xs w-14 shrink-0">{new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="text-2xl">{getEspecieEmoji(r.especie)}</span>
                          <span className="text-white font-bold flex-1">{getEspecieLabel(r.especie)}</span>
                          <span className={`font-black px-2.5 py-1 rounded-lg text-xs ${{ 
                            cazado: 'text-green-300 bg-green-900/40 border-2 border-green-700/40', 
                            herido: 'text-orange-300 bg-orange-900/40 border-2 border-orange-700/40', 
                            escapado: 'text-gray-400 bg-gray-800/40 border-2 border-gray-700/40' 
                          }[r.tipo_registro]}`}>
                            {TIPO_REGISTRO_LABELS[r.tipo_registro as keyof typeof TIPO_REGISTRO_LABELS]}
                          </span>
                          {r.notas && <span className="text-forest-muted text-xs truncate max-w-[120px]">«{r.notas}»</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
