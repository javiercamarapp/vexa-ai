#!/usr/bin/env node
// Procesa las capturas reales del producto (tools/sitio/capturar-producto.mjs) a AVIF y WebP responsivos con sharp,
// las guarda con hash en apps/web/public/s/img/producto/ y las registra en public/s/manifest.json (sección img, claves «producto/…»).
// AVIF solo donde ahorra 25 % o más contra el WebP del mismo ancho (misma regla que tools/sitio/imagenes.mjs).
//
// Uso: node tools/sitio/imagenes-producto.mjs <carpeta de capturas> [--manifiesto <salida.json>] [--idioma en]
// Sin --idioma procesa las capturas en español (claves «producto/…», limpia la carpeta y todas las claves producto/). Con --idioma en procesa las capturas en inglés
// (claves «producto/en/…», archivos «en-…») sin tocar lo español: correr primero la española.
// Dependencias fuera del repo: $SITIO_BUILD_DIR/node_modules/sharp (como imagenes.mjs).
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PUB = join(AQUI, '..', '..', 'apps', 'web', 'public', 's');
const DIR = join(PUB, 'img', 'producto');
const MANIFEST = join(PUB, 'manifest.json');
const BUILD = process.env.SITIO_BUILD_DIR || join(homedir(), 'vexa-tools', 'sitio-build');
const sharp = createRequire(join(BUILD, 'package.json'))('sharp');
const IDIOMA = process.argv.includes('--idioma') ? process.argv[process.argv.indexOf('--idioma') + 1] : 'es';
const P = IDIOMA === 'en' ? 'en/' : '', PF = IDIOMA === 'en' ? 'en-' : '';
const entrada = resolve(process.argv[2] ?? '');
const salidaManifiesto = process.argv.includes('--manifiesto') ? resolve(process.argv[process.argv.indexOf('--manifiesto') + 1]) : null;
if (!process.argv[2] || !existsSync(entrada)) { console.error('Uso: imagenes-producto.mjs <carpeta de capturas> [--manifiesto salida.json]'); process.exit(2); }

const sha = b => createHash('sha256').update(b).digest('hex');
const DATOS = {es: 'Datos de ejemplo.', en: 'Example data.'};
// id de archivo -> texto alternativo en los dos idiomas
const PANTALLAS = {
  hoy: {es: 'Pantalla Hoy de Rovaq con cuatro cifras: ingreso bruto 480,000 USD, reembolsos 36,000 USD, dinero atorado 9,000 USD y 14 hilos sin respuesta de más de 24 horas, cada una con su sello Observado.', en: 'Rovaq Today screen with four figures: gross revenue 480,000 USD, refunds 36,000 USD, stuck money 9,000 USD and 14 threads unanswered for over 24 hours, each with its Observed seal.'},
  fuga: {es: 'Pantalla Fuga de reembolsos de Rovaq: 36,000 USD devueltos, cuatro tarjetas de cifras, ranking de 10 SKU de HM-210 a HM-200 con porcentaje acumulado e intensidad por marketplace.', en: 'Rovaq Refund leakage screen: 36,000 USD returned, four figure cards, a ranking of 10 SKUs from HM-210 to HM-200 with cumulative percentage and intensity by marketplace.'},
  problemas: {es: 'Pantalla Problemas de Rovaq con tres problemas agrupados, ingresos expuestos como subtotal conocido con sello Inferido, con el aviso de que son datos parciales.', en: 'Rovaq Problems screen with three grouped problems, exposed revenue as a known subtotal with an Inferred seal, with the notice that the data is partial.'},
  caso: {es: 'Ficha de un problema de Rovaq: entrega marcada como completa sin recibirse, con 124 conversaciones, severidad alta, tendencia mensual y sello Inferido.', en: 'Rovaq problem record: delivery marked complete but not received, with 124 conversations, high severity, a monthly trend and an Inferred seal.'},
  evidencia: {es: 'Citas textuales verificadas de clientes en la ficha de un problema, cada una con su fuente, sello Observado y el botón Ver origen para comprobar su procedencia.', en: 'Verified customer quotes on a problem record, each with its source, an Observed seal and the See origin button to check where it came from.'},
  preguntale: {es: 'Pregúntale a tus datos: la pregunta sobre qué marketplace concentra más reembolsos con su respuesta en tarjetas y barras, la cobertura de cada cifra y lo que falta cargar.', en: 'Ask your data: the question about which marketplace concentrates the most refunds with its answer as cards and bars, the coverage of each figure and what is still to be loaded.'},
  cco: {es: 'Pestaña CCO de Rovaq: rendimiento por SKU y marketplace con líneas, ingreso bruto, reembolsos y reembolsos por cada 100 líneas, con lo que falta dicho de forma explícita.', en: 'Rovaq CCO tab: performance by SKU and marketplace with lines, gross revenue, refunds and refunds per 100 lines, with what is missing stated explicitly.'},
  conexiones: {es: 'Pantalla Fuentes conectadas de Rovaq: HubSpot como única conexión automática y tres exportes de marketplace cargados a mano, con su estado y su última carga.', en: 'Rovaq Connected sources screen: HubSpot as the only automatic connection and three marketplace exports uploaded by hand, with their status and last upload.'},
};
const RECORTES = {
  'pareto@2x': {id: 'pareto', es: 'Ranking de reembolsos por SKU de HM-210 a HM-200 con barras, importe y línea de porcentaje acumulado.', en: 'Ranking of refunds by SKU from HM-210 to HM-200 with bars, amount and a cumulative percentage line.'},
  'tarjetas-hoy@2x': {id: 'tarjetas-hoy', es: 'Las cuatro tarjetas de cifras de Hoy: ingreso bruto, reembolsos, dinero atorado y respuestas de más de 24 horas, cada una con su sello de procedencia.', en: 'The four figure cards of Today: gross revenue, refunds, stuck money and replies over 24 hours, each with its provenance seal.'},
  'tarjetas-fuga@2x': {id: 'tarjetas-fuga', es: 'Las cuatro tarjetas de Fuga de reembolsos: dinero devuelto, reembolsos, dinero atorado y repetición de contacto.', en: 'The four cards of Refund leakage: money returned, refunds, stuck money and repeat contact.'},
};
// Anchos por imagen: el héroe (Fuga, claro) lleva 960, 1440 y 2880; el resto 960 y 1440; los recortes su ancho nativo y la mitad.
const HEROES = ['fuga-claro', 'fuga-oscuro']; // héroe: Fuga a 960, 1440 y 2880 (la escala mayor sirve al recorte del pliegue)
const q = {webp: {quality: 80, effort: 6}, avif: {quality: 50, effort: 4}};

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
for (const k of Object.keys(manifest.img)) if (IDIOMA === 'en' ? k.startsWith('producto/en/') : k.startsWith('producto/')) delete manifest.img[k];
mkdirSync(DIR, {recursive: true});
for (const f of readdirSync(DIR)) if (IDIOMA === 'en' ? f.startsWith('en-') : true) rmSync(join(DIR, f));

const trabajos = [];
for (const f of readdirSync(entrada).filter(n => /^[a-z]+-(claro|oscuro)-1440@2x\.png$/.test(n))) {
  const [id, tema] = f.replace('-1440@2x.png', '').split('-');
  if (!PANTALLAS[id]) continue;
  const base = id + (tema === 'oscuro' ? '-oscuro' : '');
  trabajos.push({clave: base, archivo: join(entrada, f), anchos: HEROES.includes(`${id}-${tema}`) ? [960, 1440, 2880] : [960, 1440], alt: PANTALLAS[id], tema, tipo: HEROES.includes(`${id}-${tema}`) ? 'heroe' : 'captura'});
}
for (const [n, r] of Object.entries(RECORTES)) {
  const a = join(entrada, 'recortes', n + '.png'); if (!existsSync(a)) continue;
  const w = (await sharp(a).metadata()).width;
  trabajos.push({clave: r.id, archivo: a, anchos: [Math.round(w / 2), w], alt: r, tema: 'claro', tipo: 'recorte'});
}

const informe = [];
for (const t of trabajos.sort((a, b) => a.clave.localeCompare(b.clave))) {
  const webp = [], avif = [];
  for (const ancho of t.anchos) {
    const redim = await sharp(t.archivo).resize({width: ancho, kernel: 'lanczos3'});
    const wbuf = await redim.clone().webp(q.webp).toBuffer(), abuf = await redim.clone().avif(q.avif).toBuffer();
    const alto = (await sharp(wbuf).metadata()).height;
    const nombre = (b, ext) => `${PF}${t.clave}-${ancho}.${sha(b).slice(0, 8)}.${ext}`;
    writeFileSync(join(DIR, nombre(wbuf, 'webp')), wbuf);
    webp.push({alto, ancho, bytes: wbuf.length, sha256: sha(wbuf), url: `/s/img/producto/${nombre(wbuf, 'webp')}`});
    if (abuf.length <= wbuf.length * 0.75) { writeFileSync(join(DIR, nombre(abuf, 'avif')), abuf); avif.push({alto, ancho, bytes: abuf.length, sha256: sha(abuf), url: `/s/img/producto/${nombre(abuf, 'avif')}`}); }
    else informe.push({aviso: `${t.clave} ${ancho}: AVIF no ahorra 25 % (${abuf.length} contra ${wbuf.length}); solo WebP`});
  }
  const baseV = webp.find(v => v.ancho === 1440) ?? webp.at(-1);
  const e = {alt: {es: `${t.alt.es} ${DATOS.es}`, en: `${t.alt.en} ${DATOS.en}`}, alto: baseV.alto, ancho: baseV.ancho, avif, bytes: baseV.bytes, sha256: baseV.sha256, tema: t.tema, tipo: t.tipo === 'recorte' ? 'recorte' : 'captura', url: baseV.url, variantes: webp};
  manifest.img[`producto/${P}${t.clave}`] = e;
  informe.push({clave: `producto/${P}${t.clave}`, tipo: t.tipo, tema: t.tema, alt: e.alt, variantes: webp.map(v => ({ancho: v.ancho, alto: v.alto, formato: 'webp', bytes: v.bytes, url: v.url})), avif: avif.map(v => ({ancho: v.ancho, alto: v.alto, formato: 'avif', bytes: v.bytes, url: v.url}))});
}
// SVG vectorial del Pareto: se copia con hash y se registra como entrada propia (texto, brotli).
const svg = join(entrada, 'recortes', 'pareto.svg');
const nSvg = `${PF}pareto.`;
if (existsSync(svg)) {
  const b = readFileSync(svg), n = `${nSvg}${sha(b).slice(0, 8)}.svg`;
  copyFileSync(svg, join(DIR, n));
  const m = b.toString('utf8').match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  manifest.img[`producto/${P}pareto-vector`] = {alt: {es: `${RECORTES['pareto@2x'].es} Versión vectorial. ${DATOS.es}`, en: `${RECORTES['pareto@2x'].en} Vector version. ${DATOS.en}`}, alto: Math.round(Number(m[2])), ancho: Math.round(Number(m[1])), bytes: b.length, sha256: sha(b), tema: 'claro', tipo: 'recorte', url: `/s/img/producto/${n}`,
    variantes: [{alto: Math.round(Number(m[2])), ancho: Math.round(Number(m[1])), bytes: b.length, sha256: sha(b), url: `/s/img/producto/${n}`}]};
  informe.push({clave: `producto/${P}pareto-vector`, tipo: 'svg', bytes: b.length, url: `/s/img/producto/${n}`});
}
const orden = o => Array.isArray(o) ? o.map(orden) : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map(k => [k, orden(o[k])])) : o;
writeFileSync(MANIFEST, JSON.stringify(orden(manifest), null, 1) + '\n');
if (salidaManifiesto) writeFileSync(salidaManifiesto, JSON.stringify(informe, null, 1) + '\n');
const total = informe.flatMap(i => [...(i.variantes ?? []), ...(i.avif ?? [])]).reduce((s, v) => s + v.bytes, 0);
console.log(`${informe.filter(i => i.clave).length} entradas; ${total} bytes en archivos; manifest actualizado`);
for (const i of informe.filter(i => i.aviso)) console.log(i.aviso);
