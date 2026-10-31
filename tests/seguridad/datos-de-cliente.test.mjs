// Guarda de datos de cliente: el repositorio es PÚBLICO y el cliente piloto autorizó usar sus datos, no exhibirlos.
// Falla si en un archivo versionado (o nuevo sin ignorar) reaparece el UUID de su organización, su nombre comercial,
// su dominio o la huella de un archivo recibido. Los patrones se arman por partes para que este archivo no se detecte a sí mismo.
// Política y alcance: docs/seguridad/DATOS-DE-CLIENTE.md. Los datos reales viven en config/cliente-piloto.local.json (ignorado).
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync, statSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {patronesExternos, rutaPatronesExternos} from '../../config/patrones-externos.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const j = (...p) => p.join('');
const PATRONES = [
  {id: 'uuid-organizacion', rx: new RegExp(j('c85191', 'f0-55d2'), 'i')},
  {id: 'nombre-cliente', rx: new RegExp(j('sen', 'ix'), 'i')},
  {id: 'nombre-con-puntos', rx: new RegExp(j('s\\.e\\.n\\.', 'i\\.x'), 'i')},
  {id: 'huella-archivo-recibido', rx: new RegExp([j('8233', 'de16'), j('c3d8', '587c'), j('5781', '14eb'), j('fd2e', '8732'), j('4745', '3e60'), j('f602', '9ea2')].join('|'), 'i')},
];
const MAX_BYTES = 5 * 1024 * 1024;

// ---- Huellas SHA-256 de palabras sueltas (nombres de personas, bodegas, empresas, dominios y SKU reales del cliente piloto) ----
// El repo es público: ninguno de esos nombres puede escribirse aquí. Se compara el hash de cada palabra del texto (minúsculas, sin acentos, separada por cualquier signo).
// Es una barrera contra descuidos, no contra quien quiera adivinar el diccionario: la lista completa y legible vive fuera del repo (config/patrones-externos.mjs).
const HUELLAS_PERSONAS = new Set(['07d046d5fac12b3f82daf5035b9aae86db5adc8275ebfbf05ec83005a4a8ba3e', '2c7e9f6370f03f6a5357991fee4896ae11b114efae430861a37bbc214888a904']);
const HUELLAS_CLIENTE = new Set(['d51db60749a2709ca9cf7eab289bbad72852adf3e3e00716d42159e3c78225da', '7ee9b4fed1bd4144f53a233b6a0ac8832a1358a7aeaeff77bbf26a1e201eb191', 'b084aa36c5f6efdd6ff341cfea3499e7c27c134ff267cc31209bc0383ee40dc5', 'ba4aa455fda62a177941846f7557b0f1821ac681e10b29aac9202e76596a157d', 'da57c782d07097c9f8ff1b2fd7247fc19d7188c3e9cca46b732ccb62cef651f1', '78fcc8c8829060704acd2de9114e8e556ee0f45ccfc2c293725738e6edaa6ba8', '58bf2dd73ec82a1d174e61fc2dc9b1e88bb20435ee30a123a0d2827579b4aaa0', '5806540ef9eb12a5accf6220417147aad1dc8e21d322576bc50da4ad74f3a98e', '1e790fffe28cedbe6be02cc9a7e8940abe30cfa0100357ce36bcb81e9f011d58', '1d53f7684607fe2d7a944f6095e61dcc55e3ec3f2ea0cf3f36c7905c5eae6e8e', '28825d4cc2ae829ccf03a67f7cdbfb09fe5b2f27afcc37869a035a5ca5aeda7f']);
// Contenido de terceros copiado de la web (estudio de mercado): ahí pueden aparecer nombres de pila comunes que no son del cliente.
const SIN_PERSONAS = /^(negocio\/00-Fuentes\/web\/|docs\/investigacion\/fuentes\/web\/)/;
const huella = (t) => createHash('sha256').update(t).digest('hex');
const memo = new Map();
const claseDePalabra = (w) => { let c = memo.get(w); if (c === undefined) { const x = huella(w); c = HUELLAS_CLIENTE.has(x) ? 'cliente' : HUELLAS_PERSONAS.has(x) ? 'persona' : ''; memo.set(w, c); } return c; };
const palabras = (txt) => txt.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/);
/** Líneas (1-based) con una palabra del cliente o de sus personas; no devuelve la palabra. */
function lineasConHuellas(txt, rel) {
  const out = [];
  const ignoraPersonas = SIN_PERSONAS.test(rel);
  txt.split('\n').forEach((linea, i) => {
    for (const w of palabras(linea)) { const c = w.length >= 3 && w.length <= 14 ? claseDePalabra(w) : ''; if (c === 'cliente' || (c === 'persona' && !ignoraPersonas)) { out.push(i + 1); break; } }
  });
  return out;
}

// Excepciones cortas y justificadas (ruta exacta -> motivo). Añadir una exige justificarla aquí y en DATOS-DE-CLIENTE.md.
export const EXCEPCIONES = new Map([
  ['supabase/migrations/20261104000000_insights_engine.sql', 'Migración ya aplicada: su lógica clasifica el retailer propio por prefijo; editarla cambiaría el cuerpo de una función en producción. Corrección futura: migración nueva con prefijo configurable.'],
]);

function archivos() {
  const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {cwd: REPO, maxBuffer: 256 * 1024 * 1024}).toString('utf8');
  return out.split('\0').filter(Boolean);
}
const esTexto = buf => !buf.subarray(0, 8000).includes(0);

test('ningún archivo versionado expone datos del cliente piloto (salvo excepciones justificadas)', () => {
  const hallazgos = [];
  for (const rel of archivos()) {
    const abs = path.join(REPO, rel);
    if (!existsSync(abs)) continue; // borrado en el árbol de trabajo
    for (const {id, rx} of PATRONES) if (rx.test(rel)) hallazgos.push(`${rel}  [${id}: en el nombre del archivo]`);
    if (EXCEPCIONES.has(rel)) continue;
    const st = statSync(abs);
    if (!st.isFile() || st.size > MAX_BYTES) continue;
    const buf = readFileSync(abs);
    if (!esTexto(buf)) continue;
    const txt = buf.toString('utf8');
    for (const {id, rx} of PATRONES) if (rx.test(txt)) hallazgos.push(`${rel}  [${id}]`);
  }
  assert.deepEqual(hallazgos, [], `Datos de cliente en archivos versionados:\n${hallazgos.join('\n')}\nMuévalos a config/cliente-piloto.local.json o justifique una excepción.`);
});

test('ninguna palabra del cliente piloto, de sus bodegas ni de sus personas (por huella SHA-256) en archivos versionados', () => {
  const hallazgos = [];
  for (const rel of archivos()) {
    const abs = path.join(REPO, rel);
    if (!existsSync(abs) || EXCEPCIONES.has(rel)) continue;
    // Tampoco en el nombre del archivo.
    if (palabras(rel).some((w) => w.length >= 3 && w.length <= 14 && (claseDePalabra(w) === 'cliente' || (claseDePalabra(w) === 'persona' && !SIN_PERSONAS.test(rel))))) hallazgos.push(`${rel}  [huella: en el nombre del archivo]`);
    const st = statSync(abs);
    if (!st.isFile() || st.size > MAX_BYTES) continue;
    const buf = readFileSync(abs);
    if (!esTexto(buf)) continue;
    const lineas = lineasConHuellas(buf.toString('utf8'), rel);
    if (lineas.length) hallazgos.push(`${rel}  [huella: líneas ${lineas.slice(0, 8).join(', ')}${lineas.length > 8 ? ', …' : ''}]`);
  }
  assert.deepEqual(hallazgos, [], `Nombres del cliente piloto, de sus bodegas o de sus personas en archivos versionados (por huella):\n${hallazgos.join('\n')}\nUse roles genéricos («responsable de operaciones del cliente», «Bodega Alfa») o muévalo a configuración externa (VEXA_CCO_CATALOGO).`);
});

test('el archivo externo de patrones (si existe) tampoco encuentra nada en archivos versionados', t => {
  const reglas = patronesExternos();
  if (!reglas.length) return t.skip('sin archivo externo de patrones (VEXA_PATRONES_PROHIBIDOS o ~/.config/vexa/patrones-prohibidos.txt)');
  const hallazgos = [];
  for (const rel of archivos()) {
    const abs = path.join(REPO, rel);
    if (!existsSync(abs) || EXCEPCIONES.has(rel)) continue;
    const st = statSync(abs);
    if (!st.isFile() || st.size > MAX_BYTES) continue;
    const buf = readFileSync(abs);
    if (!esTexto(buf)) continue;
    const persona = SIN_PERSONAS.test(rel);
    const txt = buf.toString('utf8');
    for (const {id, rx} of reglas) {
      if (persona && /^persona-/.test(id)) continue;
      const linea = txt.split('\n').findIndex((l) => rx.test(l));
      if (linea >= 0) hallazgos.push(`${rel}:${linea + 1}  [${id}]`);
    }
  }
  assert.deepEqual(hallazgos, [], `Archivo externo ${rutaPatronesExternos()} encontró:\n${hallazgos.join('\n')}`);
});

test('las excepciones apuntan a archivos que existen (sin excepciones muertas)', () => {
  const muertas = [...EXCEPCIONES.keys()].filter(r => !existsSync(path.join(REPO, r)));
  assert.deepEqual(muertas, []);
});

test('los PDF versionados no contienen el nombre ni el UUID (si hay pdftotext)', t => {
  let tiene = true;
  try { execFileSync('pdftotext', ['-v'], {stdio: 'ignore'}); } catch (e) { tiene = e.code !== 'ENOENT' ? true : false; }
  if (!tiene) return t.skip('sin pdftotext');
  const malos = [];
  for (const rel of archivos().filter(f => f.toLowerCase().endsWith('.pdf'))) {
    let txt = '';
    try { txt = execFileSync('pdftotext', [path.join(REPO, rel), '-'], {maxBuffer: 64 * 1024 * 1024}).toString('utf8'); } catch { continue; }
    for (const {id, rx} of PATRONES) if (rx.test(txt)) malos.push(`${rel} [${id}]`);
  }
  assert.deepEqual(malos, []);
});

test('el ejemplo de configuración es genérico y la configuración local no se versiona', () => {
  const ejemplo = readFileSync(path.join(REPO, 'config/cliente-piloto.ejemplo.json'), 'utf8');
  assert.match(ejemplo, /00000000-0000-4000-8000-000000000000/);
  const versionados = archivos().filter(f => /(^|\/)cliente-piloto\.local\.json$/.test(f));
  assert.deepEqual(versionados, [], 'config/cliente-piloto.local.json debe estar ignorado por git');
});
