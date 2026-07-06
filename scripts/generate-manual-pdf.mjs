import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.resolve(__dirname, '../docs/manual-mi-batida.pdf');

const doc = new jsPDF({ unit: 'pt', format: 'a4' });
const margin = 48;
const pageHeight = doc.internal.pageSize.getHeight();
const pageWidth = doc.internal.pageSize.getWidth();
const usableWidth = pageWidth - margin * 2;

let y = 64;

function ensureSpace(heightNeeded = 24) {
  if (y + heightNeeded > pageHeight - 52) {
    doc.addPage();
    y = 56;
  }
}

function title(text) {
  ensureSpace(46);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(text, margin, y);
  y += 34;
}

function h1(text) {
  ensureSpace(34);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(text, margin, y);
  y += 22;
}

function h2(text) {
  ensureSpace(28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(text, margin, y);
  y += 18;
}

function p(text) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(text, usableWidth);
  const lineHeight = 15;
  ensureSpace(lines.length * lineHeight + 8);
  doc.text(lines, margin, y);
  y += lines.length * lineHeight + 8;
}

function list(items) {
  const bulletIndent = 12;
  const textWidth = usableWidth - bulletIndent;
  const lineHeight = 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);

  for (const item of items) {
    const lines = doc.splitTextToSize(item, textWidth);
    ensureSpace(lines.length * lineHeight + 4);
    doc.text('-', margin, y);
    doc.text(lines, margin + bulletIndent, y);
    y += lines.length * lineHeight + 4;
  }

  y += 4;
}

function separator() {
  ensureSpace(16);
  doc.setDrawColor(180);
  doc.line(margin, y, pageWidth - margin, y);
  y += 14;
}

function footer(pageCount) {
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`Mi Batida - Manual de uso - Pagina ${i}/${pageCount}`, margin, pageHeight - 24);
  }
}

const today = new Date().toLocaleString('es-ES');

title('Manual Completo - Mi Batida');
p(`Version del manual: ${today}`);
p('Este documento explica el uso completo de la app Mi Batida para organizacion de batidas, colaboracion entre usuarios, uso de mapa, registros, alertas, chat y funciones offline.');
separator();

h1('1. Objetivo de la app');
p('Mi Batida ayuda a coordinar una batida en tiempo real. Permite crear y gestionar batidas, compartir codigos de invitacion, registrar piezas, ver posiciones en mapa, enviar SOS, compartir mensajes, usar alertas y trabajar con informacion incluso cuando hay problemas de cobertura.');

h1('2. Requisitos minimos');
list([
  'Telefono Android con GPS activo.',
  'Conexion a internet para sincronizacion inicial y colaboracion en tiempo real.',
  'Permisos de ubicacion para posicion y mapa.',
  'Opcional: permisos de notificaciones/sonido para avisos SOS.',
]);

h1('3. Inicio de sesion y perfil');
h2('3.1 Registro / acceso');
list([
  'Accede con correo y contrasena.',
  'Si olvidas la contrasena, usa recuperacion con pregunta de seguridad.',
]);
h2('3.2 Perfil');
list([
  'Editar nombre visible.',
  'Subir o cambiar foto de perfil.',
  'Configurar pregunta y respuesta de seguridad.',
  'Cerrar sesion.',
]);

h1('4. Flujo general de batidas');
h2('4.1 Crear batida');
list([
  'En pantalla principal pulsa Crear batida.',
  'Define nombre y cupos por especie.',
  'Puedes incluir especies personalizadas.',
  'Selecciona tu rol inicial (postura o perrero).',
]);
h2('4.2 Unirse con codigo');
list([
  'Pulsa Unirse con codigo.',
  'Introduce el codigo de invitacion.',
  'Selecciona rol y, si aplica, nombre de puesto.',
]);
h2('4.3 Estados de miembro');
list([
  'Pendiente: esperando aprobacion de admin.',
  'Activo: participa normalmente.',
  'Abandonado: salio de la batida (puede volver).',
]);

h1('5. Compartir invitaciones');
h2('5.1 Compartir por WhatsApp');
list([
  'Desde Info de la batida puedes copiar codigo o compartir por WhatsApp.',
  'El mensaje incluye enlace directo para abrir la app y entrar con codigo.',
  'Formato de enlace directo: mibatida://join?code=CODIGO.',
]);
h2('5.2 Enlace de respaldo');
list([
  'Tambien se incluye enlace web con parametro invite.',
  'Si abres la app desde ese enlace, se precarga el codigo automaticamente.',
]);

h1('6. Mapa en tiempo real');
h2('6.1 Capas disponibles');
list([
  'Calles.',
  'Satelite.',
  'Satelite hibrido.',
]);
h2('6.2 Elementos del mapa');
list([
  'Tu posicion y posicion de miembros activos.',
  'Rastros marcados por usuarios.',
  'Puestos de la batida.',
  'Alertas de perros y SOS en mapa.',
  'Rutas historicas (si activas filtro de rutas).',
]);
h2('6.3 Filtros utiles');
list([
  'Mostrar/ocultar Yo, perreros, posturas, rastros, rutas, alertas y puestos.',
  'Los filtros ayudan en terrenos cargados de marcadores.',
]);

h1('7. GPS y SOS');
h2('7.1 GPS');
list([
  'Modo manual o intervalo automatico (1, 5, 10 min).',
  'Boton Enviar GPS para enviar ubicacion al instante.',
  'Boton centrar para volver a tu posicion.',
]);
h2('7.2 SOS');
list([
  'Pulsar SOS envia aviso al chat con coordenadas y enlace de mapa.',
  'El propio emisor tambien oye el aviso sonoro.',
  'Puedes cancelar SOS activo con el mismo boton.',
]);

h1('8. Registro de piezas');
list([
  'Registro por tipo: cazado, herido, escapado.',
  'Soporte de especies configuradas y variantes de jabali.',
  'Admins pueden registrar por otros miembros segun permisos.',
]);

h1('9. Chat de la batida');
list([
  'Mensajes de texto e imagen.',
  'Actualizacion en tiempo real y contador de no leidos.',
  'Enlaces detectados y clicables en mensajes.',
]);

h1('10. Alertas de perros y rastros');
list([
  'Alertas: perro cogido, perro visto, perro por la zona.',
  'Posibilidad de incluir datos (color, raza, direccion, propietario, nota).',
  'Rastros con especie, antiguedad y direccion.',
]);

h1('11. Totales, historial e informes');
h2('11.1 Totales en vivo');
list([
  'Resumen por especie y tipo de registro.',
  'Transcripcion en vivo con hora:min de actividad relevante.',
]);
h2('11.2 Historial de batidas finalizadas');
list([
  'Detalle de batida finalizada.',
  'Transcripcion completa.',
  'Exportacion en PDF del informe final.',
]);

h1('12. Modo offline de mapas');
h2('12.1 Crear mapa offline');
list([
  'Selecciona capa de mapa.',
  'Define nombre del mapa offline.',
  'Elige zoom minimo y maximo.',
  'Selecciona zona tocando y arrastrando en el mapa.',
  'Descarga y guarda para uso sin cobertura.',
]);
h2('12.2 Mis mapas offline (Perfil)');
list([
  'Listado de mapas guardados con nombre, capa, zoom y fecha.',
  'Boton Compartir para enviar mapa al chat.',
  'Borrado completo recomendado: elimina entrada y teselas no compartidas con otros mapas.',
]);
h2('12.3 Compartir mapas offline en chat');
list([
  'Desde Perfil puedes compartir un mapa guardado al chat de la batida activa.',
  'Cualquier miembro puede pulsar Descargar mapa offline en ese mensaje.',
  'Al descargar, se guarda en su dispositivo para uso sin cobertura.',
]);

h1('13. Cola offline de acciones');
list([
  'Si no hay conexion, ciertas acciones se encolan (mensaje, posicion, rastros, puestos, SOS segun flujo).',
  'Al recuperar internet, la cola se sincroniza automaticamente.',
  'En cabecera veras estado de red y numero de pendientes.',
]);

h1('14. Roles y administracion');
list([
  'Admins pueden aprobar/rechazar solicitudes pendientes.',
  'Silenciar o expulsar miembros segun reglas de la batida.',
  'Promover otros admins.',
  'Finalizar batida cuando termina la jornada.',
]);

h1('15. Buenas practicas de operacion');
list([
  'Antes de salir al campo, descarga mapas offline de zonas clave.',
  'Verifica GPS y permisos antes de empezar.',
  'Usa nombres claros para puestos y mapas offline.',
  'Comparte SOS solo para emergencias reales.',
  'Al finalizar, revisa informe y guarda PDF para archivo.',
]);

h1('16. Guia rapida de resolucion de problemas');
list([
  'No veo marcadores: revisa filtros del mapa y conexion.',
  'No puedo enviar mensajes: revisa estado offline y cola pendiente.',
  'No abre enlace de invitacion: confirma que la app esta instalada y actualizada.',
  'No descarga mapa offline: reduce zona o niveles de zoom.',
  'No suena SOS: desbloquea audio de la app con una interaccion previa.',
]);

h1('17. Checklist previo a batida real');
list([
  'Perfil actualizado (nombre/foto).',
  'Pregunta de seguridad configurada.',
  'Mapa offline descargado y probado.',
  'Capa correcta seleccionada para la zona.',
  'Admins asignados y roles revisados.',
  'Prueba de chat y GPS completada.',
]);

separator();
p('Fin del manual. Documento generado automaticamente desde el proyecto Mi Batida.');

const pageCount = doc.getNumberOfPages();
footer(pageCount);

await fs.mkdir(path.dirname(outputPath), { recursive: true });
const bytes = doc.output('arraybuffer');
await fs.writeFile(outputPath, Buffer.from(bytes));

console.log(`Manual PDF generado en: ${outputPath}`);
