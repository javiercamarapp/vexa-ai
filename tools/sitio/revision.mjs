#!/usr/bin/env node
// Hoja de revisión legible para Responsable A y para el abogado (T11).
// Lista, con su texto en español y en inglés, todo lo que hoy no se publica o se publica con su condición:
// textos que esperan una aprobación, verificaciones del producto sin cumplir, marcadores sin resolver y páginas pendientes.
// Solo lee el contenido. Con --aprobar o --condicion escribe apps/web/src/content/sitio/aprobaciones.json, y solo debe usarse
// con el visto bueno escrito de quien revisa: la aprobación queda atada al hash del texto y se invalida si el texto cambia.
//
//   node tools/sitio/revision.mjs                              hoja en Markdown por la salida estándar
//   node tools/sitio/revision.mjs --salida hoja.html           hoja en HTML (por la extensión)
//   node tools/sitio/revision.mjs --aprobar faq.items[8].q --revisor abogado --nota "visto bueno del 2026-11-03"
//   node tools/sitio/revision.mjs --condicion 5 --cumplida true --nota "12 corridas exitosas"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONTENIDO = path.join(raiz, 'apps/web/src/content/sitio');
const RUTA_APROBACIONES = path.join(CONTENIDO, 'aprobaciones.json');

const { LANDING, CONDICIONES, PORTADA } = await import(path.join(CONTENIDO, 'landing.ts'));
const { PAGINAS_INTERNAS } = await import(path.join(CONTENIDO, 'paginas/index.ts'));
const M = await import(path.join(raiz, 'apps/web/src/lib/sitio/marcadores.mjs'));

const REVISORES = { responsable_a: 'Responsable A', abogado: 'Abogado' };

/** Sección de la portada que consume una clave, para decir dónde aparece un texto. */
function dondeAparece(ruta) {
  if (ruta.startsWith('paginas.')) {
    const pagina = PAGINAS_INTERNAS.find((p) => ruta.startsWith(`paginas.${p.id}.`));
    return `Página interna ${pagina ? `/${pagina.id}` : ''}`.trim();
  }
  const clave = ruta.split(/[.[]/)[0];
  for (const [sec, claves] of Object.entries(PORTADA)) if (claves.includes(clave)) return sec === 'transversal' ? `Transversal (${clave})` : `Portada, ${sec} (${clave})`;
  return clave;
}

function leerAprobaciones() {
  return JSON.parse(fs.readFileSync(RUTA_APROBACIONES, 'utf8'));
}

/** Hechos de la verificación contra producción, de solo lectura, fechada. Fuente: landing/construccion/VERIFICACION-PRODUCCION.md. */
export const PRODUCCION = {
  fecha: '2026-10-29',
  hechos: [
    { condicion: 2, estado: 'Cumplida', hecho: 'Pregúntale corre solo con reglas: verificado por código, modo determinista en lib/agent/server.ts, sin interruptor de IA. Vale para el agente general; /cfo tiene su propio motor y no se afirma que sea solo reglas.', texto: 'Se quitó el estado pendiente de la página de Pregúntale.' },
    { condicion: 3, estado: 'Cumplida con matiz', hecho: 'La extracción corre en producción, 72,121 corridas y 66,418 exitosas, casi todas por lotes. problem_conversations tiene 0 filas.', texto: 'Problemas, citas y exposición se redactan como capacidad, cuando hay vínculos confirmados. No se afirma extracción en vivo por conversación nueva.' },
    { condicion: 4, estado: 'Cumplida en la base, sin uso', hecho: 'La migración del flujo de Acciones está aplicada, con 0 eventos del flujo.', texto: 'Solo se describe lo que el producto permite. Sin resultados ni casos. En inglés, Dismiss.' },
    { condicion: 5, estado: 'Cumplida con salvedad', hecho: 'Sincronización de HubSpot cada 5 minutos: 285 de 288 ciclos en 24 horas, 0 fallos registrados. connection_health marca partial con COVERAGE_INCOMPLETE y 415 de 795 páginas tuvieron un registro rechazado.', texto: 'Se publica sincronización programada cada 5 minutos, con cobertura limitada a lo que expone la API. No se dice cobertura completa ni tiempo real.' },
    { condicion: 9, estado: 'Pendiente', hecho: 'HubSpot acreditado sobre una muestra no queda cubierto por esta verificación.', texto: 'hero.pruebaDeHoy sigue fuera.' },
    { condicion: null, estado: 'Dato informativo', hecho: 'Roles: hay propietarios y analistas en uso. Operador y lector existen como puestos disponibles, sin cuentas.', texto: 'No se dice que haya equipos que ya los usen.' },
    { condicion: null, estado: 'Dato informativo', hecho: 'El registro público de Supabase está abierto (disable_signup=false). Decisión de Javier: cerrarlo o aceptarlo.', texto: 'El acceso se solicita por correo, que sigue siendo cierto. No se afirma que el acceso sea solo por invitación.' },
    { condicion: null, estado: 'Sin verificar', hecho: 'Valores de las variables sensibles de IA de Vercel, como VEXA_PAIN_AI: no legibles por diseño.', texto: 'Se verifican en el panel de Vercel; no afectan a Pregúntale.' },
  ],
};

/** Calcula todo lo que la hoja necesita. Función pura sobre aprobaciones y contexto. */
export function datosDeRevision({ aprobaciones = leerAprobaciones(), ctx = M.contextoPorDefecto() } = {}) {
  const hojasLanding = M.estadoPublicacion(LANDING, { aprobaciones, ctx });
  const hojasPaginas = PAGINAS_INTERNAS.flatMap((p) => M.estadoPublicacion(p, { aprobaciones, ctx, prefijo: `paginas.${p.id}` }));
  const todas = [...hojasLanding, ...hojasPaginas];
  const buscar = (ruta) => (ruta.startsWith('paginas.') ? hojasPaginas : hojasLanding).find((h) => h.ruta === ruta);

  const pendientes = todas.filter((h) => !h.publicable).map((h) => {
    const alt = h.alterno ? buscar(h.alterno) ?? buscar(`${h.ruta.split('.').slice(0, -1).join('.')}.${h.alterno}`) : null;
    return { ...h, dondeAparece: dondeAparece(h.ruta), alternoTexto: alt && alt.publicable ? alt : null };
  });
  const matizPublicados = todas.filter((h) => h.nivel === 'MATIZ' && h.publicable);
  const condiciones = Object.entries(CONDICIONES).map(([n, c]) => ({ n: Number(n), ...c, cumplida: aprobaciones.condiciones?.[n]?.cumplida === true, nota: aprobaciones.condiciones?.[n]?.nota ?? '' }));
  const paginas = PAGINAS_INTERNAS.map((p) => {
    const e = M.estadoPagina(p, { aprobaciones, ctx });
    return { id: p.id, publicable: e.publicable, motivo: p.pendiente ?? '', motivos: e.motivos, h1: p.h1 };
  });
  return {
    generado: new Date().toISOString().slice(0, 10),
    produccion: PRODUCCION,
    totales: {
      hojas: todas.length,
      pendientes: pendientes.length,
      matizPublicados: matizPublicados.length,
      condicionesCumplidas: condiciones.filter((c) => c.cumplida).length,
      paginasPendientes: paginas.filter((p) => !p.publicable).length,
      paginas: paginas.length,
    },
    pendientes,
    matizPublicados,
    condiciones,
    paginas,
  };
}

// ---------------------------------------------------------------- Markdown
const cita = (t) => String(t).split('\n').map((l) => `> ${l}`).join('\n');

export function aMarkdown(d) {
  const L = [];
  L.push('# Hoja de revisión del sitio de Rovaq AI');
  L.push('');
  L.push(`Generada el ${d.generado}. Para Responsable A y para el abogado. Cada texto de abajo no se publica todavía, o se publica con su condición al lado.`);
  L.push('Una aprobación queda atada al texto exacto, en español y en inglés: si el texto cambia, vuelve a pendiente y hay que aprobarlo de nuevo.');
  L.push('');
  L.push(`- Hojas de contenido revisadas: ${d.totales.hojas}`);
  L.push(`- Hojas que hoy no se publican: ${d.totales.pendientes}`);
  L.push(`- Hojas MATIZ que sí se publican, cada una con su condición: ${d.totales.matizPublicados}`);
  L.push(`- Verificaciones del producto cumplidas: ${d.totales.condicionesCumplidas} de 13`);
  L.push(`- Páginas internas pendientes de revisión: ${d.totales.paginasPendientes} de ${d.totales.paginas}`);
  L.push('');
  L.push('## 1. Textos que esperan una decisión');
  L.push('');
  const conRevisor = d.pendientes.filter((h) => h.req.length > 0 || h.verifica);
  const conMarcador = d.pendientes.filter((h) => h.req.length === 0 && !h.verifica);
  conRevisor.forEach((h, i) => {
    L.push(`### 1.${i + 1} ${h.ruta}`);
    L.push('');
    L.push(`- Dónde aparece: ${h.dondeAparece}`);
    L.push(`- Quién revisa: ${h.req.map((r) => REVISORES[r] ?? r).join(' y ') || 'nadie; espera una verificación del producto'}`);
    if (h.condicion) L.push(`- Condición ${h.condicion.n === 0 ? '(va junto a otros textos)' : h.condicion.n}: ${h.condicion.texto}`);
    if (h.verifica) L.push(`- Verificación ${h.verifica} del producto: ${CONDICIONES[h.verifica].texto}. Se comprueba así: ${CONDICIONES[h.verifica].verificar}.`);
    L.push(`- Por qué no se publica: ${h.motivos.join('; ')}`);
    L.push(`- Mientras tanto se publica: ${h.alternoTexto ? `la versión alterna (${h.alterno})` : 'nada, la pieza queda fuera'}`);
    L.push(`- Huella del texto: \`${h.hash.slice(0, 16)}\``);
    L.push('');
    L.push('Español:');
    L.push(cita(h.es));
    L.push('');
    L.push('Inglés:');
    L.push(cita(h.en));
    if (h.alternoTexto) {
      L.push('');
      L.push('Versión alterna que se publica mientras tanto:');
      L.push(cita(`ES: ${h.alternoTexto.es}`));
      L.push(cita(`EN: ${h.alternoTexto.en}`));
    }
    L.push('');
    L.push('Decisión: [ ] Aprobado   [ ] Aprobado con cambios   [ ] No publicar        Nombre y fecha: ____________________');
    L.push('');
  });
  if (conRevisor.length === 0) L.push('Ninguno.', '');
  L.push('## 2. Campos bloqueados por un dato que falta');
  L.push('');
  L.push('Se publican en cuanto se resuelva el marcador. No requieren que Responsable A ni el abogado los lean antes; requieren un dato de Javier.');
  L.push('');
  if (conMarcador.length === 0) L.push('Ninguno.');
  for (const h of conMarcador) L.push(`- ${h.ruta} (${h.dondeAparece}): ${h.motivos.join('; ')}. Texto: ${h.es}`);
  L.push('');
  L.push('## 3. Verificaciones del producto');
  L.push('');
  L.push('| N | Condición | Cómo se comprueba | Si no se cumple | Estado |');
  L.push('|---|---|---|---|---|');
  for (const c of d.condiciones) L.push(`| ${c.n} | ${c.texto} | ${c.verificar} | ${c.siNo} | ${c.cumplida ? 'Cumplida' : 'Sin cumplir'} |`);
  L.push('');
  L.push('## 4. Páginas internas');
  L.push('');
  L.push('| Página | Título | Estado | Motivo |');
  L.push('|---|---|---|---|');
  for (const p of d.paginas) L.push(`| /${p.id} | ${p.h1.es} | ${p.publicable ? 'Publicable' : 'Pendiente de revisión'} | ${p.motivo || p.motivos.join('; ') || ''} |`);
  L.push('');
  L.push('## 5. Textos MATIZ que se publican con su condición');
  L.push('');
  L.push('Se afirman solo con la condición escrita al lado. Se listan para que se pueda objetar cualquiera.');
  L.push('');
  L.push('| Dónde | Condición | Texto en español |');
  L.push('|---|---|---|');
  for (const h of d.matizPublicados) L.push(`| ${h.ruta} | ${h.condicion.n === 0 ? 'va junto a ' + (h.condicion.acompana ?? []).join(', ') : h.condicion.n}: ${h.condicion.texto.replace(/\|/g, '/')} | ${h.es.replace(/\|/g, '/')} |`);
  L.push('');
  L.push(`## 6. Verificación en producción (${d.produccion.fecha})`);
  L.push('');
  L.push('Solo lectura contra la base y el código. No se imprimieron valores secretos ni datos de clientes.');
  L.push('');
  L.push('| Condición | Estado | Hecho | Qué hace el texto |');
  L.push('|---|---|---|---|');
  for (const h of d.produccion.hechos) L.push(`| ${h.condicion ?? '-'} | ${h.estado} | ${h.hecho.replace(/\|/g, '/')} | ${h.texto.replace(/\|/g, '/')} |`);
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------- HTML
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function aHtml(d) {
  const md = aMarkdown(d).split('\n');
  const salida = [];
  let tabla = [];
  let cita_ = [];
  let lista = [];
  const cerrar = () => {
    if (tabla.length) {
      const filas = tabla.filter((f) => !/^\|[-| ]+\|$/.test(f)).map((f) => f.slice(1, -1).split('|').map((c) => c.trim()));
      salida.push('<table>', ...filas.map((f, i) => `<tr>${f.map((c) => `<${i === 0 ? 'th' : 'td'}>${esc(c)}</${i === 0 ? 'th' : 'td'}>`).join('')}</tr>`), '</table>');
      tabla = [];
    }
    if (cita_.length) { salida.push(`<blockquote>${cita_.map(esc).join('<br>')}</blockquote>`); cita_ = []; }
    if (lista.length) { salida.push('<ul>', ...lista.map((x) => `<li>${esc(x)}</li>`), '</ul>'); lista = []; }
  };
  for (const l of md) {
    if (l.startsWith('|')) { tabla.push(l); continue; }
    if (l.startsWith('> ')) { cita_.push(l.slice(2)); continue; }
    if (l.startsWith('- ')) { lista.push(l.slice(2)); continue; }
    cerrar();
    if (l.startsWith('### ')) salida.push(`<h3>${esc(l.slice(4))}</h3>`);
    else if (l.startsWith('## ')) salida.push(`<h2>${esc(l.slice(3))}</h2>`);
    else if (l.startsWith('# ')) salida.push(`<h1>${esc(l.slice(2))}</h1>`);
    else if (l.trim() !== '') salida.push(`<p>${esc(l)}</p>`);
  }
  cerrar();
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hoja de revisión del sitio de Rovaq AI</title>
<style>
body{font:16px/1.6 system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem;color:#111}
h1{font-size:1.8rem}h2{margin-top:2.5rem;border-top:1px solid #ccc;padding-top:1rem}h3{margin-top:2rem}
blockquote{margin:.5rem 0;padding:.5rem 1rem;border-left:3px solid #999;background:#f4f4f5}
table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{border:1px solid #ccc;padding:.4rem;text-align:left;vertical-align:top}
</style></head><body>
${salida.join('\n')}
</body></html>
`;
}

// ---------------------------------------------------------------- línea de comandos
function argumentos(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    a[k.slice(2)] = v;
  }
  return a;
}

function hojaPorRutaGlobal(ruta) {
  if (ruta.startsWith('paginas.')) {
    const p = PAGINAS_INTERNAS.find((x) => ruta.startsWith(`paginas.${x.id}.`));
    if (!p) return undefined;
    return M.hojaEn(p, ruta.slice(`paginas.${p.id}.`.length));
  }
  return M.hojaEn(LANDING, ruta);
}

async function principal() {
  const a = argumentos(process.argv.slice(2));
  if (a.aprobar) {
    const hoja = hojaPorRutaGlobal(a.aprobar);
    if (!hoja || !M.esHoja(hoja)) throw new Error(`No existe la hoja ${a.aprobar}`);
    if (!['responsable_a', 'abogado'].includes(a.revisor)) throw new Error('--revisor debe ser responsable_a o abogado');
    if (!(hoja.req ?? []).includes(a.revisor)) throw new Error(`${a.aprobar} no pide la aprobación de ${a.revisor}; pide: ${(hoja.req ?? []).join(', ') || 'ninguna'}`);
    const nuevo = M.aprobar(leerAprobaciones(), a.aprobar, a.revisor, hoja, { fecha: a.fecha, nota: a.nota === 'true' ? '' : a.nota });
    fs.writeFileSync(RUTA_APROBACIONES, `${JSON.stringify(nuevo, null, 2)}\n`);
    console.error(`Aprobación de ${a.revisor} registrada sobre ${a.aprobar}, atada al hash ${M.hashTexto(hoja).slice(0, 16)}.`);
    return;
  }
  if (a.condicion) {
    const n = Number(a.condicion);
    if (!CONDICIONES[n]) throw new Error('--condicion debe ser de 1 a 13');
    const nuevo = M.marcarCondicion(leerAprobaciones(), n, a.cumplida !== 'false', { fecha: a.fecha, nota: a.nota === 'true' ? '' : a.nota });
    fs.writeFileSync(RUTA_APROBACIONES, `${JSON.stringify(nuevo, null, 2)}\n`);
    console.error(`Verificación ${n} marcada como ${a.cumplida !== 'false' ? 'cumplida' : 'sin cumplir'}.`);
    return;
  }
  const d = datosDeRevision();
  const html = a.formato === 'html' || (a.salida && /\.html?$/.test(a.salida));
  const texto = html ? aHtml(d) : aMarkdown(d);
  if (a.salida && a.salida !== 'true') {
    fs.writeFileSync(a.salida, texto);
    console.error(`Hoja escrita en ${a.salida}: ${d.totales.pendientes} hojas pendientes, ${d.totales.paginasPendientes} páginas pendientes.`);
  } else {
    process.stdout.write(`${texto}\n`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch((e) => { console.error(e.message); process.exit(1); });
}
