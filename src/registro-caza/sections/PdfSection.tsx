import { useState } from 'react';
import { FileText, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import {
  caceriasDB, caceriaPerrosDB, caceriaAnimalesDB, caceriaPerroEspeciesDB,
  saludDB, gastosDB, cronometrosDB, perrosHistorialDB, gpsPuntosDB,
  rastreosDB, rastreoPuntosDB, telefonosDB, collaresGpsDB
} from '../lib/db';
import type { Perro } from '../lib/types';

interface Props {
  perros: Perro[];
  perreraId: string;
}

function calcEdad(fecha: string | null) {
  if (!fecha) return '-';
  const hoy = new Date();
  const nac = new Date(fecha);
  let anos = hoy.getFullYear() - nac.getFullYear();
  let meses = hoy.getMonth() - nac.getMonth();
  if (meses < 0) { anos--; meses += 12; }
  return anos > 0 ? `${anos} años ${meses} meses` : `${meses} meses`;
}

function fmtFecha(f: string | null | undefined) {
  if (!f) return '-';
  return new Date(f).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDuracion(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`;
}

export default function PdfSection({ perros, perreraId }: Props) {
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [progress, setProgress] = useState('');

  const generateAndDownload = async () => {
    setGenerating(true);
    setStatus('idle');
    try {
      setProgress('Cargando datos...');
      const cacerias = await caceriasDB.list(perreraId);
      const caceriaPerros = await caceriaPerrosDB.listAll(perreraId);
      const allCpIds = caceriaPerros.map(cp => cp.id);
      const caceriaPerroEspecies = await caceriaPerroEspeciesDB.listByPerroIds(allCpIds);
      const allCacIds = cacerias.map(c => c.id);
      const caceriaAnimales = (await Promise.all(
        allCacIds.map(id => caceriaAnimalesDB.listByCaceria(id))
      )).flat();
      const salud = (await saludDB.list(perreraId)).sort((a, b) => b.fecha.localeCompare(a.fecha));
      const gastos = await gastosDB.list(perreraId);
      const cronometros = await cronometrosDB.listWithPerro(perreraId);
      const historial = (await Promise.all(
        perros.map(p => perrosHistorialDB.listByPerro(p.id))
      )).flat().sort((a, b) => b.fecha.localeCompare(a.fecha));
      const gpsPuntos = await gpsPuntosDB.list(perreraId);
      const rastreos = await rastreosDB.list(perreraId);
      const allRastreoIds = rastreos.map(r => r.id);
      const rastreoPuntos = (await Promise.all(
        allRastreoIds.map(id => rastreoPuntosDB.listByRastreo(id))
      )).flat();
      const telefonos = await telefonosDB.list(perreraId);
      const collares = (await collaresGpsDB.list(perreraId)).sort((a, b) => a.nombre.localeCompare(b.nombre));

      setProgress('Generando informe...');

      const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const hoyISO = new Date().toISOString().split('T')[0];

      // Mapas de ayuda
      const perroMap = Object.fromEntries(perros.map(p => [p.id, p]));

      // Totales generales cacerías
      const totalCaz = (caceriaAnimales || []).reduce((s, a) => s + (a.cazados || 0), 0);
      const totalMov = (caceriaAnimales || []).reduce((s, a) => s + (a.movidos || 0), 0);
      const totalEsc = (caceriaAnimales || []).reduce((s, a) => s + (a.escapados || 0), 0);

      // Gastos totales por categoría
      const gastosPorCat: Record<string, number> = {};
      (gastos || []).forEach(g => {
        gastosPorCat[g.categoria] = (gastosPorCat[g.categoria] || 0) + (g.importe || 0);
      });
      const totalGastos = (gastos || []).reduce((s, g) => s + (g.importe || 0), 0);

      // Stats por perro
      const perroStatsMap: Record<string, { lev: number; per: number; perd: number; muer: number; cacs: number }> = {};
      (caceriaPerros || []).forEach(cp => {
        if (!perroStatsMap[cp.perro_id]) perroStatsMap[cp.perro_id] = { lev: 0, per: 0, perd: 0, muer: 0, cacs: 0 };
        perroStatsMap[cp.perro_id].lev += cp.levantados || 0;
        perroStatsMap[cp.perro_id].per += cp.perseguidos || 0;
        perroStatsMap[cp.perro_id].perd += cp.perdidos || 0;
        perroStatsMap[cp.perro_id].muer += cp.muertes || 0;
        perroStatsMap[cp.perro_id].cacs += 1;
      });

      const css = `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; background: #fff; font-size: 13px; line-height: 1.5; }
        .cover { background: linear-gradient(135deg, #78350f 0%, #92400e 40%, #b45309 100%); color: white; padding: 60px 40px; text-align: center; page-break-after: always; }
        .cover h1 { font-size: 36px; font-weight: 800; letter-spacing: -1px; margin-bottom: 8px; }
        .cover .sub { font-size: 16px; opacity: 0.8; margin-bottom: 40px; }
        .cover .meta { display: flex; justify-content: center; gap: 40px; flex-wrap: wrap; margin-top: 40px; }
        .cover .meta-item { background: rgba(255,255,255,0.15); border-radius: 12px; padding: 16px 24px; }
        .cover .meta-item .val { font-size: 32px; font-weight: 800; }
        .cover .meta-item .lbl { font-size: 12px; opacity: 0.7; margin-top: 2px; }
        .page { padding: 32px 40px; }
        h2 { font-size: 20px; font-weight: 700; color: #78350f; border-bottom: 3px solid #d97706; padding-bottom: 8px; margin: 32px 0 16px; }
        h3 { font-size: 15px; font-weight: 600; color: #92400e; margin: 20px 0 10px; border-left: 4px solid #d97706; padding-left: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
        thead tr { background: #78350f; color: white; }
        th { padding: 8px 10px; text-align: left; font-weight: 600; font-size: 11px; letter-spacing: 0.3px; }
        td { padding: 7px 10px; border-bottom: 1px solid #f0e6d3; }
        tr:nth-child(even) td { background: #fffbf5; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 600; }
        .badge-green { background: #d1fae5; color: #065f46; }
        .badge-blue { background: #dbeafe; color: #1e40af; }
        .badge-red { background: #fee2e2; color: #991b1b; }
        .badge-amber { background: #fef3c7; color: #92400e; }
        .badge-gray { background: #f3f4f6; color: #374151; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
        .stat-box { background: #fffbf5; border: 1px solid #f0e6d3; border-radius: 10px; padding: 14px; text-align: center; }
        .stat-box .val { font-size: 28px; font-weight: 800; color: #78350f; }
        .stat-box .lbl { font-size: 11px; color: #a16207; margin-top: 2px; }
        .perro-card { border: 1px solid #f0e6d3; border-radius: 12px; padding: 16px; margin-bottom: 16px; background: #fffbf5; }
        .perro-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .perro-name { font-size: 17px; font-weight: 700; color: #78350f; }
        .perro-raza { font-size: 12px; color: #a16207; }
        .perro-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 12px; }
        .perro-stat { background: white; border: 1px solid #f0e6d3; border-radius: 8px; padding: 8px; text-align: center; }
        .perro-stat .val { font-size: 18px; font-weight: 700; color: #92400e; }
        .perro-stat .lbl { font-size: 10px; color: #b45309; }
        .caceria-row td:first-child { font-weight: 600; }
        .especie-tag { display: inline-block; background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; border-radius: 6px; padding: 1px 7px; margin: 1px; font-size: 11px; }
        .footer { margin-top: 60px; text-align: center; color: #aaa; font-size: 11px; border-top: 1px solid #f0e6d3; padding-top: 16px; }
        @media print {
          .cover { page-break-after: always; }
          h2 { page-break-before: auto; }
          .perro-card { page-break-inside: avoid; }
          tr { page-break-inside: avoid; }
        }
      `;

      // Construir sección de perros con detalle completo
      const perrosSection = perros.map(p => {
        const st = perroStatsMap[p.id] || { lev: 0, per: 0, perd: 0, muer: 0, cacs: 0 };
        const saludPerro = (salud || []).filter(s => s.perro_id === p.id);
        const histPerro = (historial || []).filter(h => h.perro_id === p.id);
        const cronoPerro = (cronometros || []).filter(c => c.perro_id === p.id);

        // Especies del perro
        const cpIds = new Set((caceriaPerros || []).filter(cp => cp.perro_id === p.id).map(cp => cp.id));
        const especiesPerro: Record<string, Record<string, number>> = {};
        (caceriaPerroEspecies || []).filter(e => cpIds.has(e.caceria_perro_id)).forEach(e => {
          if (!especiesPerro[e.especie]) especiesPerro[e.especie] = {};
          especiesPerro[e.especie][e.campo] = (especiesPerro[e.especie][e.campo] || 0) + (e.cantidad || 0);
        });

        return `
          <div class="perro-card">
            <div class="perro-header">
              <div>
                <div class="perro-name">${p.nombre}</div>
                <div class="perro-raza">${p.raza || 'Raza no especificada'} · ${p.sexo} · ${calcEdad(p.fecha_nacimiento)}</div>
              </div>
              <div style="text-align:right;font-size:11px;color:#a16207;">
                ${p.chip ? `<div>Chip: ${p.chip}</div>` : ''}
                ${p.peso ? `<div>Peso: ${p.peso} kg</div>` : ''}
              </div>
            </div>
            ${(p.padre || p.madre) ? `<div style="font-size:11px;color:#a16207;margin-bottom:10px;">${p.padre ? `Padre: ${p.padre}` : ''} ${p.madre ? `· Madre: ${p.madre}` : ''}</div>` : ''}
            ${p.notas ? `<div style="font-size:12px;color:#555;margin-bottom:10px;font-style:italic;">"${p.notas}"</div>` : ''}

            <div class="perro-stats">
              <div class="perro-stat"><div class="val">${st.cacs}</div><div class="lbl">Cacerías</div></div>
              <div class="perro-stat"><div class="val" style="color:#16a34a">${st.lev}</div><div class="lbl">Levantados</div></div>
              <div class="perro-stat"><div class="val" style="color:#2563eb">${st.per}</div><div class="lbl">Perseguidos</div></div>
              <div class="perro-stat"><div class="val" style="color:#ea580c">${st.perd}</div><div class="lbl">Perdidos</div></div>
              <div class="perro-stat"><div class="val" style="color:#dc2626">${st.muer}</div><div class="lbl">Muertes</div></div>
            </div>

            ${Object.keys(especiesPerro).length > 0 ? `
              <div style="margin-top:12px;">
                <div style="font-size:11px;font-weight:600;color:#a16207;margin-bottom:6px;">POR ESPECIE</div>
                <table style="font-size:11px;">
                  <thead><tr><th>Especie</th><th>Levantados</th><th>Perseguidos</th><th>Perdidos</th><th>Muertes</th></tr></thead>
                  <tbody>
                    ${Object.entries(especiesPerro).map(([esp, vals]) => `
                      <tr><td><strong>${esp}</strong></td><td>${vals.levantados || 0}</td><td>${vals.perseguidos || 0}</td><td>${vals.perdidos || 0}</td><td>${vals.muertes || 0}</td></tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}

            ${saludPerro.length > 0 ? `
              <div style="margin-top:12px;">
                <div style="font-size:11px;font-weight:600;color:#a16207;margin-bottom:6px;">SALUD (${saludPerro.length} registros)</div>
                <table style="font-size:11px;">
                  <thead><tr><th>Tipo</th><th>Fecha</th><th>Próxima</th><th>Notas</th></tr></thead>
                  <tbody>
                    ${saludPerro.map(s => `<tr><td>${s.tipo}</td><td>${fmtFecha(s.fecha)}</td><td>${fmtFecha(s.fecha_proximo)}</td><td>${s.notas || '-'}</td></tr>`).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}

            ${cronoPerro.length > 0 ? `
              <div style="margin-top:12px;">
                <div style="font-size:11px;font-weight:600;color:#a16207;margin-bottom:6px;">CRONÓMETROS (${cronoPerro.length})</div>
                <table style="font-size:11px;">
                  <thead><tr><th>Fecha</th><th>Duración</th><th>Notas</th></tr></thead>
                  <tbody>
                    ${cronoPerro.map(c => `<tr><td>${fmtFecha(c.fecha)}</td><td>${fmtDuracion(c.duracion_segundos)}</td><td>${c.notas || '-'}</td></tr>`).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}

            ${histPerro.length > 0 ? `
              <div style="margin-top:12px;">
                <div style="font-size:11px;font-weight:600;color:#a16207;margin-bottom:6px;">HISTORIAL (${histPerro.length})</div>
                <table style="font-size:11px;">
                  <thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th></tr></thead>
                  <tbody>
                    ${histPerro.map(h => `<tr><td>${fmtFecha(h.fecha)}</td><td>${h.tipo}</td><td>${h.descripcion || '-'}</td></tr>`).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      // Sección cacerías con detalle
      const caceriasRows = (cacerias || []).map(c => {
        const animales = (caceriaAnimales || []).filter(a => a.caceria_id === c.id);
        const caz = animales.reduce((s, a) => s + (a.cazados || 0), 0);
        const mov = animales.reduce((s, a) => s + (a.movidos || 0), 0);
        const esc = animales.reduce((s, a) => s + (a.escapados || 0), 0);
        const participantes = (caceriaPerros || [])
          .filter(cp => cp.caceria_id === c.id)
          .map(cp => perroMap[cp.perro_id]?.nombre || '?')
          .join(', ');
        const especiesStr = animales.map(a => `<span class="especie-tag">${a.especie}: ${a.cazados}c/${a.movidos}m/${a.escapados}e</span>`).join('');
        return `<tr class="caceria-row">
          <td>${fmtFecha(c.fecha)}</td>
          <td>${c.lugar || '-'}</td>
          <td>${c.modalidad || '-'}</td>
          <td><span class="badge badge-green">${caz}</span></td>
          <td><span class="badge badge-blue">${mov}</span></td>
          <td><span class="badge badge-red">${esc}</span></td>
          <td>${especiesStr || '-'}</td>
          <td style="font-size:11px;">${participantes || '-'}</td>
        </tr>`;
      }).join('');

      // Sección gastos
      const gastosRows = (gastos || []).map(g =>
        `<tr><td>${fmtFecha(g.fecha)}</td><td>${g.categoria}</td><td>${g.descripcion || '-'}</td><td style="font-weight:600;color:#92400e;">€${Number(g.importe || 0).toFixed(2)}</td><td>${g.notas || '-'}</td></tr>`
      ).join('');

      const gastosCatRows = Object.entries(gastosPorCat)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, imp]) => `<tr><td>${cat}</td><td style="font-weight:600;">€${imp.toFixed(2)}</td><td>${Math.round((imp / totalGastos) * 100)}%</td></tr>`)
        .join('');

      // GPS
      const gpsRows = (gpsPuntos || []).map(g =>
        `<tr><td>${g.nombre || '-'}</td><td>${g.tipo}</td><td style="font-size:11px;font-family:monospace;">${g.latitud ?? '-'}, ${g.longitud ?? '-'}</td><td>${fmtFecha(g.fecha_hora)}</td><td>${g.notas || '-'}</td></tr>`
      ).join('');

      // Rastreos
      const rastreosRows = (rastreos || []).map(r => {
        const puntos = (rastreoPuntos || []).filter(p => p.rastreo_id === r.id);
        return `<tr><td>${r.nombre}</td><td>${fmtFecha(r.fecha)}</td><td>${puntos.length} puntos</td><td>${r.notas || '-'}</td></tr>`;
      }).join('');

      // Teléfonos
      const telefonosRows = (telefonos || []).map(t =>
        `<tr><td>${t.nombre}</td><td>${t.telefono}</td><td>${t.tipo}</td><td>${t.notas || '-'}</td></tr>`
      ).join('');

      // Collares GPS
      const collaresRows = (collares || []).map(c =>
        `<tr><td>${c.nombre}</td><td style="font-family:monospace;font-size:11px;">${c.id_collar || '-'}</td><td>${c.codigo_adiestramiento || '-'}</td><td>${c.notas || '-'}</td></tr>`
      ).join('');

      const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mi Registro de Caza · Informe completo ${hoyISO}</title>
<style>${css}</style>
</head>
<body>

<!-- PORTADA -->
<div class="cover">
  <div style="font-size:13px;opacity:0.6;margin-bottom:8px;letter-spacing:2px;text-transform:uppercase;">Informe Completo</div>
  <h1>Mi Registro de Caza</h1>
  <div class="sub">Generado el ${hoy}</div>
  <div class="meta">
    <div class="meta-item"><div class="val">${perros.length}</div><div class="lbl">Perros</div></div>
    <div class="meta-item"><div class="val">${(cacerias || []).length}</div><div class="lbl">Cacerías</div></div>
    <div class="meta-item"><div class="val">${totalCaz}</div><div class="lbl">Cazados</div></div>
    <div class="meta-item"><div class="val">€${totalGastos.toFixed(0)}</div><div class="lbl">Gastos totales</div></div>
  </div>
</div>

<div class="page">

<!-- RESUMEN GENERAL -->
<h2>Resumen General</h2>
<div class="stats-grid">
  <div class="stat-box"><div class="val">${(cacerias || []).length}</div><div class="lbl">Cacerías</div></div>
  <div class="stat-box"><div class="val" style="color:#16a34a">${totalCaz}</div><div class="lbl">Cazados</div></div>
  <div class="stat-box"><div class="val" style="color:#2563eb">${totalMov}</div><div class="lbl">Movidos</div></div>
  <div class="stat-box"><div class="val" style="color:#dc2626">${totalEsc}</div><div class="lbl">Escapados</div></div>
</div>
<div class="stats-grid">
  <div class="stat-box"><div class="val">${(salud || []).length}</div><div class="lbl">Registros salud</div></div>
  <div class="stat-box"><div class="val">${(cronometros || []).length}</div><div class="lbl">Cronómetros</div></div>
  <div class="stat-box"><div class="val">${(gpsPuntos || []).length}</div><div class="lbl">Puntos GPS</div></div>
  <div class="stat-box"><div class="val" style="color:#92400e">€${totalGastos.toFixed(2)}</div><div class="lbl">Total gastos</div></div>
</div>

<!-- PERROS -->
<h2>Perros Registrados (${perros.length})</h2>
${perros.length === 0 ? '<p style="color:#999">No hay perros registrados.</p>' : perrosSection}

<!-- CACERIAS -->
<h2>Historial de Cacerías (${(cacerias || []).length})</h2>
${(cacerias || []).length === 0 ? '<p style="color:#999">No hay cacerías registradas.</p>' : `
<table>
  <thead><tr><th>Fecha</th><th>Lugar</th><th>Modalidad</th><th>Cazados</th><th>Movidos</th><th>Escapados</th><th>Especies</th><th>Perros</th></tr></thead>
  <tbody>${caceriasRows}</tbody>
</table>`}

<!-- GASTOS -->
<h2>Gastos (${(gastos || []).length})</h2>
${(gastos || []).length === 0 ? '<p style="color:#999">No hay gastos registrados.</p>' : `
<h3>Resumen por categoría</h3>
<table style="width:auto;min-width:300px;">
  <thead><tr><th>Categoría</th><th>Total</th><th>% del total</th></tr></thead>
  <tbody>${gastosCatRows}</tbody>
  <tfoot><tr style="background:#78350f;color:white;"><td><strong>TOTAL</strong></td><td><strong>€${totalGastos.toFixed(2)}</strong></td><td>100%</td></tr></tfoot>
</table>
<h3>Detalle de gastos</h3>
<table>
  <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Importe</th><th>Notas</th></tr></thead>
  <tbody>${gastosRows}</tbody>
</table>`}

<!-- GPS -->
<h2>Puntos GPS (${(gpsPuntos || []).length})</h2>
${(gpsPuntos || []).length === 0 ? '<p style="color:#999">No hay puntos GPS guardados.</p>' : `
<table>
  <thead><tr><th>Nombre</th><th>Tipo</th><th>Coordenadas</th><th>Fecha</th><th>Notas</th></tr></thead>
  <tbody>${gpsRows}</tbody>
</table>`}

<!-- RASTREOS -->
<h2>Rastreos (${(rastreos || []).length})</h2>
${(rastreos || []).length === 0 ? '<p style="color:#999">No hay rastreos registrados.</p>' : `
<table>
  <thead><tr><th>Nombre</th><th>Fecha</th><th>Puntos</th><th>Notas</th></tr></thead>
  <tbody>${rastreosRows}</tbody>
</table>`}

<!-- TELÉFONOS -->
<h2>Contactos / Teléfonos (${(telefonos || []).length})</h2>
${(telefonos || []).length === 0 ? '<p style="color:#999">No hay contactos registrados.</p>' : `
<table>
  <thead><tr><th>Nombre</th><th>Teléfono</th><th>Tipo</th><th>Notas</th></tr></thead>
  <tbody>${telefonosRows}</tbody>
</table>`}

<!-- COLLARES GPS -->
<h2>Collares GPS (${(collares || []).length})</h2>
${(collares || []).length === 0 ? '<p style="color:#999">No hay collares registrados.</p>' : `
<table>
  <thead><tr><th>Nombre</th><th>ID Collar</th><th>Código adiestramiento</th><th>Notas</th></tr></thead>
  <tbody>${collaresRows}</tbody>
</table>`}

<div class="footer">
  Mi Registro de Caza V4.0 · app creada por Sergio Ibero · Informe generado el ${hoy}
</div>

</div>
</body>
</html>`;

      const fileName = `registro_caza_${hoyISO}.html`;

      if (Capacitor.isNativePlatform()) {
        // En Android: guardar en cache y abrir menú compartir
        await Filesystem.writeFile({
          path: fileName,
          data: html,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
        const canShare = await Share.canShare();
        if (canShare.value) {
          await Share.share({
            title: 'Informe Mi Registro de Caza',
            text: `Informe generado el ${hoy}`,
            url: uri,
            dialogTitle: 'Guardar o compartir informe',
          });
        } else {
          await Filesystem.writeFile({
            path: fileName,
            data: html,
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
          });
        }
      } else {
        // En navegador web: descarga directa
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      setStatus('ok');
      setProgress('');
    } catch {
      setStatus('error');
      setProgress('');
    } finally {
      setGenerating(false);
    }
  };

  const sections = [
    'Perros: ficha completa, estadísticas y por especie',
    'Cacerías: historial con especies y perros participantes',
    'Salud: todos los registros por perro',
    'Gastos: detalle y resumen por categoría',
    'GPS: todos los puntos guardados',
    'Rastreos: listado con puntos marcados',
    'Cronómetros: tiempos por perro',
    'Contactos y collares GPS',
  ];

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-amber-300 font-bold text-lg">Informe Completo</h2>

      <div className="bg-black/30 border border-amber-700/20 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-900/30 border-2 border-amber-700/40 flex items-center justify-center flex-shrink-0">
            <FileText size={30} className="text-amber-500" />
          </div>
          <div>
            <p className="text-amber-200 font-semibold text-base">Informe HTML completo</p>
            <p className="text-amber-700 text-sm mt-0.5">Todas las secciones · Listo para imprimir como PDF</p>
          </div>
        </div>

        {status === 'ok' && (
          <div className="flex items-center gap-2 bg-green-900/20 border border-green-700/30 rounded-xl px-4 py-3 text-green-400 text-sm">
            <CheckCircle size={16} />
            Informe descargado correctamente. Abrelo desde tu gestor de archivos.
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-2 bg-red-900/20 border border-red-700/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            <AlertCircle size={16} />
            Error al generar el informe. Inténtalo de nuevo.
          </div>
        )}

        <button
          onClick={generateAndDownload}
          disabled={generating}
          className="w-full flex items-center justify-center gap-3 bg-amber-700 hover:bg-amber-600 active:bg-amber-800 disabled:opacity-60 text-white font-bold py-4 rounded-xl transition-colors text-base"
        >
          <Download size={20} />
          {generating ? (progress || 'Generando...') : 'Descargar Informe'}
        </button>

        <p className="text-amber-800 text-xs text-center leading-relaxed">
          {Capacitor.isNativePlatform()
            ? <>Se abrirá un menú para <strong className="text-amber-700">elegir dónde guardar</strong> el archivo (Drive, Archivos, WhatsApp…).<br />Ábrelo en el navegador y usa <strong className="text-amber-700">Imprimir → Guardar como PDF</strong>.</>
            : <>El archivo se guarda en <strong className="text-amber-700">Descargas</strong>. Ábrelo en el navegador y usa <strong className="text-amber-700">Imprimir → Guardar como PDF</strong>.</>
          }
        </p>
      </div>

      <div className="bg-black/20 border border-amber-700/10 rounded-xl p-4 space-y-2">
        <p className="text-amber-500 text-xs font-semibold uppercase tracking-wider mb-3">El informe incluye</p>
        {sections.map(item => (
          <div key={item} className="flex items-start gap-2 text-amber-700 text-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 flex-shrink-0" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
