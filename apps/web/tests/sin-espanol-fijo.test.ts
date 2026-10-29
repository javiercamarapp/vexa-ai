// Falla si aparece texto fijo en español en un componente de las pantallas: todo texto visible pasa por claves i18n (ES y EN con paridad).
// Dos niveles: (1) componentes .tsx de src/app y src/components: CERO hallazgos fuera de EXCEPCIONES_TSX; (2) módulos .mjs/.ts de pantallas (src/components, src/lib):
// el español canónico que ya vive junto a su traducción (X(ctx,clave,es), TXT.es, textos de fallback que fijan las pruebas) no puede CRECER: tope por archivo (TOPE_MODULOS).
// Detección: literales y texto JSX con tildes, ñ, ¿ ¡ o varias palabras vacías del español; se ignoran comentarios, el 3.er argumento de una llamada con clave
// («t('a.b','texto')») y los pares bilingües inline t('es','en'). Para actualizar un tope: baja el número cuando traduzcas; subirlo exige justificarlo aquí.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const RAIZ = new URL('../src', import.meta.url).pathname;
const ES_PALABRAS = /\b(de|del|la|las|los|el|y|en|para|por|sin|con|una?|tu|tus|que|se|su|más|hay|aún|ver|todos?|nuevo|nueva|guardar|cancelar|cerrar|buscar|cargando|volver|siguiente|anterior|datos|cliente|clientes|pedidos|ventas|mes|meses|semana|días?|no|es|son|al|como|menos|pero|desde|hasta|esta|este|entre)\b/gi;
const ACENTOS = /[áéíóúñ¿¡]/i;

/** Quita comentarios y el español de respaldo que acompaña a una clave: 'a.b','texto' deja solo 'a.b'. */
function limpiar(fuente: string): string {
  let s = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
  s = s.replace(/('[a-z][\w]*(?:\.[\w]+)+')\s*,\s*(?:'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)/g, '$1');
  s = s.replace(/\bt\(\s*'(?:[^'\\\n]|\\.)*'\s*,\s*'(?:[^'\\\n]|\\.)*'\s*\)/g, 't()'); // par bilingüe inline t('es','en')
  return s;
}
export function hallazgos(fuente: string): string[] {
  const s = limpiar(fuente), out: string[] = [];
  for (const m of s.matchAll(/'([^'\n\\]{4,})'|"([^"\n\\]{4,})"|`([^`\n]{4,})`|(?<![=-])>([^<>{}=;\n]{4,})</g)) {
    const t = m[1] ?? m[2] ?? m[3] ?? m[4];
    if (/^[\w./@:#?&=%-]+$/.test(t) || (!ACENTOS.test(t) && t.split(' ').every((w) => /[-_]/.test(w))) || /[{};]|=>|\)\s*\(/.test(t) || /^[\w-]+( [\w-]+)+$/.test(t) && !ACENTOS.test(t) && (t.match(ES_PALABRAS) || []).length < 2) continue;
    const n = (t.match(ES_PALABRAS) || []).length;
    if ((ACENTOS.test(t) && (n >= 1 || t.includes(' '))) || n >= 2) out.push(t);
  }
  return out;
}
const ignorar = (rel: string) => /(^|\/)(sitio|landing)(\/|$)|^content\/|^lib\/i18n\/|\.test\.|^app\/\(app\)\/\(sitio\)/.test(rel);
function archivos(dir: string, ext: RegExp, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = dir + '/' + e.name, rel = p.slice(RAIZ.length + 1);
    if (e.isDirectory()) { if (!ignorar(rel + '/')) archivos(p, ext, acc); } else if (ext.test(e.name) && !ignorar(rel)) acc.push(rel);
  }
  return acc;
}

/** Excepciones justificadas de componentes .tsx (archivo → motivo). */
const EXCEPCIONES_TSX: Record<string, string> = {
  'app/(app)/login/page.tsx': 'pares bilingües inline t(es, en) y autónimos de idioma («Español»); se resuelven en el servidor con ?lang= / cookie',
  'app/opengraph-image.tsx': 'imagen Open Graph de la marca: metadato de redes, no pantalla del producto; el sitio público tiene su propio idioma por host',
  'app/(app)/(workspace)/layout.tsx': 'nombres de organizaciones y soporte SINTÉTICOS del modo de pruebas (solo next dev con VEXA_UI_FIXTURES=1)',
  'app/(app)/(workspace)/cfo/page.tsx': 'nombre de organización sintética del modo de pruebas',
  'app/(app)/(workspace)/pain-points/page.tsx': 'nombre de organización sintética del modo de pruebas',
  'app/(app)/(workspace)/refunds/page.tsx': 'nombre de organización sintética del modo de pruebas',
  'components/agente/trace.tsx': 'respaldo ESTADO_ES indexado por el nombre de estado que manda el agente; el texto visible sale de claves ag.*',
  'components/platform/platform-views.tsx': 'las 7 preguntas del copiloto de plataforma son claves de búsqueda de su traducción (PLATFORM_SHORTCUTS), no texto que se pinta',
  'components/platform/eventos-seguridad.tsx': 'PENDIENTE: vista nueva de eventos de seguridad que construye el agente de seguridad en paralelo (solo superadmin); traducir cuando se estabilice',
  'app/(app)/sin-acceso/page.tsx': 'nombres de empresa sintéticos del modo de pruebas',
};
/** Tope de español canónico en módulos de datos de pantalla (archivo → máximo de hallazgos). Se genera con UPDATE_TOPES=1 y solo debe bajar. */
const TOPE_MODULOS: Record<string, number> = {
 'components/agente/attachments.ts': 1,
 'components/agente/store.ts': 2,
 'components/agente/use-agente.ts': 2,
 'components/confianza/confianza-modelo.mjs': 29,
 'components/copiloto/adaptador-cfo.mjs': 1,
 'components/copiloto/briefing-cfo.mjs': 9,
 'components/gaps/gaps-archivos.mjs': 7,
 'components/gaps/gaps-modelo.mjs': 7,
 'components/hoy/hoy-textos.mjs': 38,
 'components/map/geo/generar-geo.mjs': 1,
 'components/map/mapa-modelo.mjs': 2,
 'components/pain-points/burbujas-modelo.mjs': 7,
 'components/pain-points/modelo.mjs': 2,
 'components/refunds/fuga-archivos.mjs': 16,
 'components/refunds/fuga-modelo.mjs': 11,
 'components/ui/use-json.ts': 2,
 'components/workspace/cfo-model.mjs': 4,
 'lib/auth-http.ts': 1,
 'lib/connections/estado.mjs': 5,
 'lib/copiloto/modos.mjs': 11,
 'lib/db-resiliencia.mjs': 1,
 'lib/epistemic.mjs': 3,
 'lib/history/historico.mjs': 16,
 'lib/imports/connection-options.ts': 1,
 'lib/jobs/progreso.mjs': 5,
 'lib/legibilidad/brief.mjs': 3,
 'lib/legibilidad/caida.mjs': 1,
 'lib/legibilidad/categorias.mjs': 37,
 'lib/legibilidad/dinero.mjs': 2,
 'lib/legibilidad/espera.mjs': 7,
 'lib/legibilidad/explorador.mjs': 2,
 'lib/legibilidad/ficha.mjs': 7,
 'lib/legibilidad/fuentes.mjs': 2,
 'lib/legibilidad/guias.mjs': 24,
 'lib/legibilidad/insights.mjs': 7,
 'lib/legibilidad/jerga.mjs': 4,
 'lib/legibilidad/meses.mjs': 1,
 'lib/legibilidad/problemas-catalogo.mjs': 1,
 'lib/legibilidad/recomendaciones-vista.mjs': 13,
 'lib/legibilidad/resumen-ejecutivo.mjs': 7,
 'lib/legibilidad/sincronizacion.mjs': 19,
 'lib/legibilidad/titulo-descriptivo.mjs': 1,
 'lib/legibilidad/unidades.mjs': 1,
 'lib/notifications/avisos.mjs': 7,
 'lib/notifications/duracion.mjs': 1,
 'lib/onboarding/catalogo.mjs': 1,
 'lib/platform/clients.ts': 3,
 'lib/platform/ficha-model.ts': 1,
 'lib/platform/palette.ts': 1,
 'lib/recovery/retencion.mjs': 1,
 'lib/site.mjs': 5,
 'lib/workspace/alcance.mjs': 3,
 'lib/workspace/data.ts': 2,
 'lib/workspace/menu.mjs': 13,
 'lib/workspace/reintento.mjs': 2
};

test('ningún componente .tsx de pantallas lleva texto fijo en español (excepciones justificadas en EXCEPCIONES_TSX)', () => {
  const malos: string[] = [];
  for (const rel of archivos(RAIZ, /\.tsx$/)) {
    if (!/^(app|components)\//.test(rel) || rel in EXCEPCIONES_TSX) continue;
    const h = hallazgos(fs.readFileSync(RAIZ + '/' + rel, 'utf8'));
    if (h.length) malos.push(`${rel}: ${h.length} (${h.slice(0, 3).map((x) => JSON.stringify(x.slice(0, 50))).join(', ')})`);
  }
  assert.deepEqual(malos, [], 'texto fijo en español; usa claves i18n con ES y EN');
});

test('las excepciones de .tsx existen y siguen teniendo español (si ya no lo tienen, quítalas)', () => {
  for (const [rel, motivo] of Object.entries(EXCEPCIONES_TSX)) {
    assert.ok(motivo.length > 20, 'motivo explícito: ' + rel);
    assert.ok(fs.existsSync(RAIZ + '/' + rel), 'no existe: ' + rel);
  }
});

test('el español canónico de módulos .mjs/.ts de pantallas no crece (TOPE_MODULOS)', () => {
  const actual: Record<string, number> = {};
  for (const rel of archivos(RAIZ, /\.(mjs|ts)$/)) {
    if (!/^(components|lib)\//.test(rel) || /\.d\.m?ts$/.test(rel)) continue;
    const n = hallazgos(fs.readFileSync(RAIZ + '/' + rel, 'utf8')).length;
    if (n) actual[rel] = n;
  }
  if (process.env.UPDATE_TOPES === '1') { fs.writeFileSync('/tmp/topes-modulos.json', JSON.stringify(actual, null, 1)); return; }
  const crecen = Object.entries(actual).filter(([rel, n]) => n > (TOPE_MODULOS[rel] ?? 0)).map(([rel, n]) => `${rel}: ${n} > tope ${TOPE_MODULOS[rel] ?? 0}`);
  assert.deepEqual(crecen, [], 'más español fijo que el tope; traduce o justifica');
});

test('el detector reconoce español, ignora claves con respaldo, pares bilingües e identificadores', () => {
  assert.deepEqual(hallazgos(`<p>Sin datos para este periodo</p>`), ['Sin datos para este periodo']);
  assert.deepEqual(hallazgos(`const a = 'Cargando…'; const x = 'Guardar los cambios';`), ['Guardar los cambios']);
  assert.deepEqual(hallazgos(`t('hoy.titulo','Hoy en el negocio de tu empresa')`), []);
  assert.deepEqual(hallazgos(`t('Cerrar sesión','Sign out')`), []);
  assert.deepEqual(hallazgos(`// comentario con acentos: ¿qué pasó?\nconst k = 'overview-card_x';`), []);
  assert.deepEqual(hallazgos(`<button>Save changes</button>`), []);
});
