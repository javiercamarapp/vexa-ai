#!/usr/bin/env node
// Recortes de las capturas reales para los cuatro pasos de la portada y la sección de valor (tema oscuro). Parte de los PNG originales 2880 por 1800
// (carpeta de capturas de capturar-producto.mjs), recorta una región en unidades de 2000 por 1250 y la guarda en AVIF y WebP al ancho nativo.
// Registra solo las claves producto/valor, paso1..4 y pantalla5 en public/s/manifest.json; no toca las demás entradas ni borra archivos.
//
// Uso: node tools/sitio/recortes-pasos.mjs <carpeta de capturas>
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
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
const entrada = resolve(process.argv[2] ?? '');
if (!process.argv[2] || !existsSync(entrada)) { console.error('Uso: recortes-pasos.mjs <carpeta de capturas>'); process.exit(2); }

const K = 1.44; // unidades de 2000 a píxeles del original de 2880
const sha = (b) => createHash('sha256').update(b).digest('hex');
const DATOS = {es: 'Datos de ejemplo.', en: 'Example data.'};
export const PASOS = {
  // Las cuatro tarjetas de cifras de Hoy (cada una con su sello Observado), sin la barra lateral ni los avisos rojos de la pantalla.
  valor: {origen: 'hoy-oscuro-1440@2x.png', x: 400, y: 388, w: 1550, h: 235, ancho: 1560,
    es: 'Las cuatro tarjetas de cifras de Hoy en Rovaq: ingreso bruto, reembolsos, dinero atorado y respuestas de más de 24 horas, cada una con su sello Observado y su fuente.',
    en: 'The four figure cards of Today in Rovaq: gross revenue, refunds, stuck money and replies over 24 hours, each with its Observed seal and source.'},
  paso1: {origen: 'conexiones-oscuro-1440@2x.png', x: 420, y: 640, w: 565, h: 450,
    es: 'Fuentes conectadas de Rovaq: HubSpot conectada y tres exportes de marketplace cargados a mano, cada uno con su estado.',
    en: 'Rovaq connected sources: HubSpot connected and three marketplace exports uploaded by hand, each with its status.'},
  paso2: {origen: 'problemas-oscuro-1440@2x.png', x: 400, y: 590, w: 1020, h: 310,
    es: 'Ingresos expuestos por problema en Rovaq: tres problemas agrupados, dos con importe inferido y uno sin importe.',
    en: 'Revenue exposed per problem in Rovaq: three grouped problems, two with an inferred amount and one with no amount.'},
  paso3: {origen: 'hoy-oscuro-1440@2x.png', x: 400, y: 390, w: 1160, h: 225,
    es: 'Tarjetas de Hoy en Rovaq: ingreso bruto de octubre y reembolsos del periodo, cada una con su sello Observado.',
    en: 'Rovaq Today cards: gross revenue for October and refunds for the period, each with its Observed seal.'},
  // Zona inferior de Hoy en tema claro (observado vs recuperable y siguiente mejor acción) para la quinta de las seis pantallas (sección clara).
  pantalla5: {origen: 'hoy-claro-1440@2x.png', x: 760, y: 560, w: 1190, h: 690, ancho: 1200, tema: 'claro',
    es: 'Tarjetas de Hoy en Rovaq: lo observado frente a lo recuperable y la tarjeta Siguiente mejor acción, que propone preparar el paquete de reclamo de un SKU con el aviso de que no se envía nada.',
    en: 'Rovaq Today cards: observed versus recoverable, and the Next best action card, which proposes preparing the claim package for a SKU with the notice that nothing is sent.'},
  paso4: {origen: 'hoy-oscuro-1440@2x.png', x: 1440, y: 630, w: 505, h: 315,
    es: 'Tarjeta Siguiente mejor acción de Rovaq: preparar el paquete de reclamo de un SKU, con el aviso de que no se envía nada.',
    en: 'Rovaq Next best action card: prepare the claim package for a SKU, with the notice that nothing is sent.'},
};

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
mkdirSync(DIR, {recursive: true});
for (const [id, p] of Object.entries(PASOS)) {
  const base = sharp(join(entrada, p.origen)).extract({left: Math.round(p.x * K), top: Math.round(p.y * K), width: Math.round(p.w * K), height: Math.round(p.h * K)});
  const dim = p.ancho ? base.clone().resize({width: p.ancho, kernel: 'lanczos3'}) : base;
  const wbuf = await dim.clone().webp({quality: 76, effort: 6}).toBuffer();
  const abuf = await dim.clone().avif({quality: 45, effort: 5}).toBuffer();
  const {width, height} = await sharp(wbuf).metadata();
  const nom = (b, ext) => `${id}-${width}.${sha(b).slice(0, 8)}.${ext}`;
  writeFileSync(join(DIR, nom(wbuf, 'webp')), wbuf);
  const conAvif = abuf.length <= wbuf.length * 0.75; // misma regla que imagenes-producto.mjs: AVIF solo si ahorra 25 % o más
  if (conAvif) writeFileSync(join(DIR, nom(abuf, 'avif')), abuf);
  const v = {alto: height, ancho: width, bytes: wbuf.length, sha256: sha(wbuf), url: `/s/img/producto/${nom(wbuf, 'webp')}`};
  manifest.img[`producto/${id}`] = {
    alt: {es: `${p.es} ${DATOS.es}`, en: `${p.en} ${DATOS.en}`}, alto: height, ancho: width,
    avif: conAvif ? [{alto: height, ancho: width, bytes: abuf.length, sha256: sha(abuf), url: `/s/img/producto/${nom(abuf, 'avif')}`}] : [],
    bytes: wbuf.length, sha256: v.sha256, tema: p.tema ?? 'oscuro', tipo: 'recorte', url: v.url, variantes: [v],
  };
  console.log(id, width, height, 'webp', wbuf.length, 'avif', abuf.length);
}
const orden = (o) => Array.isArray(o) ? o.map(orden) : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, orden(o[k])])) : o;
writeFileSync(MANIFEST, JSON.stringify(orden(manifest), null, 1) + '\n');
