// Guarda de datos de cliente: el repositorio es PÚBLICO y el cliente piloto autorizó usar sus datos, no exhibirlos.
// Falla si en un archivo versionado (o nuevo sin ignorar) reaparece el UUID de su organización, su nombre comercial,
// su dominio o la huella de un archivo recibido. Los patrones se arman por partes para que este archivo no se detecte a sí mismo.
// Política y alcance: docs/seguridad/DATOS-DE-CLIENTE.md. Los datos reales viven en config/cliente-piloto.local.json (ignorado).
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, statSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const j = (...p) => p.join('');
const PATRONES = [
  {id: 'uuid-organizacion', rx: new RegExp(j('c85191', 'f0-55d2'), 'i')},
  {id: 'nombre-cliente', rx: new RegExp(j('sen', 'ix'), 'i')},
  {id: 'nombre-con-puntos', rx: new RegExp(j('s\\.e\\.n\\.', 'i\\.x'), 'i')},
  {id: 'huella-archivo-recibido', rx: new RegExp([j('8233', 'de16'), j('c3d8', '587c'), j('5781', '14eb'), j('fd2e', '8732'), j('4745', '3e60'), j('f602', '9ea2')].join('|'), 'i')},
];
const MAX_BYTES = 5 * 1024 * 1024;

// Excepciones cortas y justificadas (ruta exacta -> motivo). Añadir una exige justificarla aquí y en DATOS-DE-CLIENTE.md.
export const EXCEPCIONES = new Map([
  ['supabase/migrations/20261104000000_insights_engine.sql', 'Migración ya aplicada: su lógica clasifica el retailer propio por prefijo; editarla cambiaría el cuerpo de una función en producción. Corrección futura: migración nueva con prefijo configurable.'],
  ['apps/web/tests/sitio/prohibidas.json', 'Lista de términos PROHIBIDOS en el sitio público: contiene el nombre precisamente para impedir que aparezca.'],
  ['apps/web/tests/sitio/contenido.test.mjs', 'Prueba del sitio público: usa el nombre como cadena que no debe publicarse; pertenece al carril del sitio.'],
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
