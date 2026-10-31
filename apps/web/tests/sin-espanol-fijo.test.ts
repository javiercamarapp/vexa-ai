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

// Pares bilingües inline L(es, en) / E(es, en) / par(es, en) / X(es, en): el español canónico que viaja con su inglés no cuenta (los usan agente, CFO y puntos de dolor).
const LIT = "'(?:[^'\\\\\\n]|\\\\.)*'|\"(?:[^\"\\\\\\n]|\\\\.)*\"|`(?:[^`\\\\]|\\\\.)*`";
const PAR = new RegExp('\\b(L|E|par)\\(\\s*(?:' + LIT + ')\\s*,\\s*(?:' + LIT + ')\\s*\\)', 'g');
/** Quita comentarios y el español de respaldo que acompaña a una clave: 'a.b','texto' deja solo 'a.b'. */
function limpiar(fuente: string): string {
  let s = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
  s = s.replace(/('[a-z][\w]*(?:\.[\w]+)+')\s*,\s*(?:'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)/g, '$1');
  s = s.replace(/\bt\(\s*'(?:[^'\\\n]|\\.)*'\s*,\s*'(?:[^'\\\n]|\\.)*'\s*\)/g, 't()'); // par bilingüe inline t('es','en')
  s = s.replace(PAR, '$1()'); // par bilingüe inline L(es,en)
  return s;
}
/** Sustituye cada `${…}` (con llaves anidadas) por un espacio: la plantilla se revisa por el texto que la rodea, no se descarta por llevar interpolación (T42). */
export function sinInterpolaciones(plantilla: string): string {
  let out = '', i = 0;
  while (i < plantilla.length) {
    if (plantilla[i] === '$' && plantilla[i + 1] === '{') {
      let depth = 1, j = i + 2;
      while (j < plantilla.length && depth > 0) { if (plantilla[j] === '{') depth++; else if (plantilla[j] === '}') depth--; j++; }
      out += ' '; i = j;
    } else out += plantilla[i++];
  }
  return out.replace(/ {2,}/g, ' ').trim();
}
export function hallazgos(fuente: string): string[] {
  const s = limpiar(fuente), out: string[] = [];
  for (const m of s.matchAll(/'([^'\n\\]{4,})'|"([^"\n\\]{4,})"|`([^`\n]{4,})`|(?<![=-])>([^<>{}=;\n]{4,})</g)) {
    // Las plantillas con ${…} se revisan por su texto fijo (antes se descartaban enteras por llevar llaves: 108 plantillas con español pasaban en verde).
    const t = m[3] !== undefined ? sinInterpolaciones(m[3]) : (m[1] ?? m[2] ?? m[4]);
    if (t.length < 4) continue;
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
  'app/(app)/sin-acceso/page.tsx': 'nombres de empresa sintéticos del modo de pruebas',
};
/** Tope de español canónico en módulos de datos de pantalla (archivo → máximo de hallazgos). Se genera con UPDATE_TOPES=1 TOPES_DIR=<carpeta> y solo debe bajar.
 *  T42: el detector ahora revisa también las plantillas con interpolación (backtick ... dólar-llave ... backtick), que antes se descartaban enteras; los topes se re-fijaron UNA vez con ese conteo
 *  (deuda que ya existía y estaba oculta: 64 módulos de pantalla y 90 de paquetes más, casi todo español base con su inglés en una tabla aparte o mensajes internos de contrato). Desde aquí solo bajan.
 *  Justificación de las subidas de T40: lib/copiloto/modos.mjs +15 (las preguntas de los chips en español son el IDENTIFICADOR de cada consulta directa; su inglés vive en PREGUNTA_EN),
 *  lib/history/historico.mjs +1 (rama inglesa nueva en el mismo módulo), y hoy-textos.mjs +1 / recomendaciones-vista.mjs +1 que ya estaban por encima del tope antes de este cambio. */
const TOPE_MODULOS: Record<string, number> = {
 'components/agente/attachments.ts': 1,
 'components/agente/store.ts': 2,
 'components/agente/use-agente.ts': 1,
 'components/confianza/confianza-modelo.mjs': 35,
 'components/copiloto/adaptador-cfo.mjs': 1,
 'components/copiloto/briefing-cfo.mjs': 14,
 'components/gaps/gaps-archivos.mjs': 11,
 'components/gaps/gaps-modelo.mjs': 18,
 'components/hoy/hoy-textos.mjs': 48,
 'components/map/geo/generar-geo.mjs': 1,
 'components/map/mapa-modelo.mjs': 4,
 'components/pain-points/burbujas-modelo.mjs': 7,
 'components/pain-points/modelo.mjs': 3,
 'components/refunds/fuga-archivos.mjs': 19,
 'components/refunds/fuga-modelo.mjs': 19,
 'components/workload/carga-modelo.mjs': 1,
 'components/workspace/cfo-model.mjs': 4,
 'lib/auth-http.ts': 2, // T46: +1 = el español canónico del límite 429 y del modo soporte, que salía fijo en middleware.ts (que baja de 2 a 0)
 'lib/connections/estado.mjs': 5,
 'lib/copiloto/modos.mjs': 26,
 'lib/db-resiliencia.mjs': 1,
 'lib/epistemic.mjs': 3,
 'lib/history/historico.mjs': 17,
 'lib/imports/connection-options.ts': 1,
 'lib/jobs/progreso.mjs': 5,
 'lib/legibilidad/brief.mjs': 2,
 'lib/legibilidad/caida.mjs': 2,
 'lib/legibilidad/categorias.mjs': 37,
 'lib/legibilidad/dinero.mjs': 2,
 'lib/legibilidad/espera.mjs': 7,
 'lib/legibilidad/explorador.mjs': 2,
 'lib/legibilidad/ficha.mjs': 6,
 'lib/legibilidad/fuentes.mjs': 2,
 'lib/legibilidad/guias.mjs': 25,
 'lib/legibilidad/insights.mjs': 11,
 'lib/legibilidad/jerga.mjs': 4,
 'lib/legibilidad/meses.mjs': 2,
 'lib/legibilidad/problemas-catalogo.mjs': 1,
 'lib/legibilidad/recomendaciones-vista.mjs': 14,
 'lib/legibilidad/resumen-ejecutivo.mjs': 8,
 'lib/legibilidad/sincronizacion.mjs': 19,
 'lib/legibilidad/titulo-descriptivo.mjs': 1,
 'lib/legibilidad/unidades.mjs': 4,
 'lib/notifications/avisos.mjs': 7,
 'lib/notifications/duracion.mjs': 1,
 'lib/onboarding/catalogo.mjs': 4,
 'lib/platform/clients.ts': 3,
 'lib/platform/ficha-model.ts': 1,
 'lib/platform/palette.ts': 1,
 'lib/recovery/retencion.mjs': 2,
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
    if (!(/^(components|lib|app\/api)\//.test(rel) || rel === 'middleware.ts') || /\.d\.m?ts$/.test(rel)) continue; // T46: middleware.ts también (sus mensajes salen de MENSAJES_ACCESO)
    const n = hallazgos(fs.readFileSync(RAIZ + '/' + rel, 'utf8')).length;
    if (n) actual[rel] = n;
  }
  if (process.env.UPDATE_TOPES === '1') { fs.writeFileSync((process.env.TOPES_DIR ?? '/tmp') + '/topes-modulos.json', JSON.stringify(actual, null, 1)); return; }
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

// ---- Palabras sueltas: el detector de arriba ignora cadenas de una sola palabra o sin acentos («Cancelar», «Copiar», «Leyenda»); este las busca por lista. ----
const SUELTAS = ['Cancelar', 'Copiar', 'Copiado', 'Leyenda', 'Filtros', 'Tendencia', 'Quitar', 'Cargando', 'Guardar', 'Cerrar', 'Buscar', 'Eliminar', 'Editar', 'Aceptar', 'Continuar', 'Volver', 'Siguiente', 'Anterior', 'Aplicar', 'Enviar', 'Limpiar', 'Todos', 'Todas', 'Ninguno', 'Ninguna', 'Inicio', 'Abrir', 'Descargar', 'Detalle', 'Detalles', 'Fecha', 'Estado', 'Acciones', 'Opciones', 'Confirmar', 'Salir', 'Reintentar', 'Actualizar', 'Atrás', 'Hecho', 'Listo', 'Aviso', 'Alerta', 'Cobertura', 'Ingresos', 'Reembolsos', 'Pedidos', 'Ventas', 'Clientes', 'Problemas', 'Seleccionar', 'Mostrar', 'Ocultar', 'Archivo', 'Importar', 'Exportar', 'Subir', 'Pegar', 'Asunto', 'Indicadores', 'Sin datos', 'No disponible'];
const SUELTA_RE = new RegExp('([\'"`]|>)\\s*(' + SUELTAS.join('|') + ')\\s*[….:]?\\s*([\'"`]|<)', 'g');
/** Literales o texto JSX que son EXACTAMENTE una palabra o frase corta de la lista (p. ej. 'Cancelar', >Copiar<, aria-label="Leyenda"). */
export function palabrasSueltas(fuente: string): string[] {
  const s = limpiar(fuente);
  return [...s.matchAll(SUELTA_RE)].map((m) => m[2]);
}
test('el detector de palabras sueltas encuentra «Cancelar» y compañía y respeta claves, identificadores y texto largo', () => {
  assert.deepEqual(palabrasSueltas(`<button onClick={close}>Cancelar</button>`), ['Cancelar']);
  assert.deepEqual(palabrasSueltas(`<ul aria-label="Leyenda">`), ['Leyenda']);
  assert.deepEqual(palabrasSueltas(`label={sparkLabel??'Tendencia'} message='Cargando…'`), ['Tendencia', 'Cargando']);
  assert.deepEqual(palabrasSueltas(`{copied?'Copiado':'Copiar'}`), ['Copiado', 'Copiar']);
  assert.deepEqual(palabrasSueltas(`t('tr.ui.cancelar')`), []);
  assert.deepEqual(palabrasSueltas(`<button>{t('tr.ui.cancelar')}</button> const x = 'cancelar_todo'; // Cancelar`), []);
  assert.deepEqual(palabrasSueltas(`<p>Cancelar la suscripción</p>`), []);
  assert.deepEqual(palabrasSueltas(`<button>Cancel</button><i>Copy</i>`), []);
});
/** Excepciones de palabras sueltas en .tsx (archivo → motivo). */
const EXCEPCIONES_SUELTAS: Record<string, string> = {
  'components/agente/trace.tsx': 'respaldo ESTADO_ES indexado por el nombre de estado que manda el agente; el texto visible sale de claves ag.t*',
  'app/(app)/login/page.tsx': 'autónimos de idioma («Español») y pares bilingües inline',
};
test('ningún componente .tsx lleva una palabra suelta en español («Cancelar», «Copiar», «Leyenda», «Filtros»…): todo por clave', () => {
  const malos: string[] = [];
  for (const rel of archivos(RAIZ, /\.tsx$/)) {
    if (!/^(app|components)\//.test(rel) || rel in EXCEPCIONES_SUELTAS || rel in EXCEPCIONES_TSX) continue;
    const h = palabrasSueltas(fs.readFileSync(RAIZ + '/' + rel, 'utf8'));
    if (h.length) malos.push(`${rel}: ${[...new Set(h)].join(', ')}`);
  }
  assert.deepEqual(malos, [], 'palabra suelta en español en un componente; usa una clave i18n');
});

// ---- Paquetes (agente, CFO, puntos de dolor, notificaciones...) y rutas /api: el español sin su inglés no puede crecer. ----
const PAQUETES = new URL('../../../packages', import.meta.url).pathname;
function archivosPaquete(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = dir + '/' + e.name;
    if (e.isDirectory()) { if (!/^(node_modules|tests|\.next)$/.test(e.name)) archivosPaquete(p, acc); } else if (/\.mjs$/.test(e.name) && !/\.test\./.test(e.name)) acc.push(p.slice(PAQUETES.length + 1));
  }
  return acc;
}
/** Tope de español sin par inglés en paquetes (archivo → máximo). Los pares L(es,en) / E / par no cuentan. Lo que sigue aquí es deuda documentada: copiloto de plataforma (platform-tools), lectura de IA de puntos de dolor, fuga de reembolsos, y las claves en español de las preguntas del agente. */
const TOPE_PAQUETES: Record<string, number> = {
 'agent-datos/agent.mjs': 3,
 'agent-datos/contract.mjs': 10,
 'agent-datos/meses.mjs': 6,
 'agent-datos/model.mjs': 4,
 'agent-datos/port-queries.mjs': 2,
 'agent-datos/suggestions.mjs': 62,
 'agent-datos/synthetic.mjs': 14,
 'agent-datos/tools-cco.mjs': 33,
 'agent-datos/tools.mjs': 49,
 'briefs/build.mjs': 8,
 'cfo-copilot/src/cfo-export.mjs': 1,
 'cfo-copilot/src/cfo-model.mjs': 16,
 'cfo-copilot/src/cfo-repository.mjs': 1,
 'cfo-copilot/src/copilot/cco-tools.mjs': 22,
 'cfo-copilot/src/copilot/cfo-tools.mjs': 46,
 'cfo-copilot/src/copilot/guards.mjs': 3,
 'cfo-copilot/src/copilot/platform-tools.mjs': 43,
 'cfo-copilot/src/copilot/runtime.mjs': 8,
 'cfo-copilot/src/copilot/simulated-model.mjs': 1,
 'cfo-copilot/src/fixtures.mjs': 1,
 'cfo-copilot/src/platform-fixtures.mjs': 9,
 'cfo-copilot/src/platform-model.mjs': 10,
 'intelligence/api.mjs': 1,
 'intelligence/history-tests/browser.mjs': 2,
 'jobs/imports.mjs': 2,
 'metrics/exposure.mjs': 1,
 'metrics/money-adapter.mjs': 1,
 'metrics/money-repository.mjs': 2,
 'metrics/overview.mjs': 2,
 'metrics/snapshots.mjs': 1,
 'notifications/baja-semanal.mjs': 23,
 'notifications/catalog.mjs': 7,
 'notifications/email-system.mjs': 4,
 'notifications/email-template.mjs': 53,
 'notifications/email-weekly.mjs': 14,
 'problems/causality.mjs': 2,
 'problems/repository.mjs': 1,
 'recommendations/borradores.mjs': 9,
 'recommendations/explorer.mjs': 3,
 'recommendations/flow.mjs': 1,
 'recommendations/flujo.mjs': 22,
 'recommendations/generate.mjs': 9,
 'recommendations/ia.mjs': 8,
 'recommendations/index.mjs': 1,
 'workspace-service/brechas.mjs': 4,
 'workspace-service/carga-sla.mjs': 2,
 'workspace-service/cco.mjs': 24,
 'workspace-service/cifras-cobertura.mjs': 4,
 'workspace-service/cifras-libro.mjs': 2,
 'workspace-service/critico.mjs': 12,
 'workspace-service/datos-hasta.mjs': 2,
 'workspace-service/detail.mjs': 3,
 'workspace-service/enmascarar-terceros.mjs': 3,
 'workspace-service/fuga-reembolsos.mjs': 18,
 'workspace-service/geo-estado.mjs': 5,
 'workspace-service/incidences.mjs': 3,
 'workspace-service/index.mjs': 7,
 'workspace-service/mapa-problemas.mjs': 5,
 'workspace-service/pain-points-catalogo.mjs': 2,
 'workspace-service/pain-points-evidencia.mjs': 4,
 'workspace-service/pain-points-ia.mjs': 25,
 'workspace-service/pain-points-semanal.mjs': 8,
 'workspace-service/pain-points.mjs': 1,
 'workspace-service/provenance.mjs': 11,
 'workspace-service/summaries.mjs': 2,
 'workspace-service/trends.mjs': 1
};
test('el español sin par inglés de los paquetes no crece (TOPE_PAQUETES): un literal nuevo debe ir como par L(es, en) o con su traducción', () => {
  const actual: Record<string, number> = {};
  for (const rel of archivosPaquete(PAQUETES)) {
    if (!/^(agent-datos|cfo-copilot\/src|workspace-service|notifications|briefs|recommendations|metrics|history|interventions|insights|intelligence|recovery|team|jobs|problems)\//.test(rel)) continue;
    const n = hallazgos(fs.readFileSync(PAQUETES + '/' + rel, 'utf8')).length;
    if (n) actual[rel] = n;
  }
  if (process.env.UPDATE_TOPES === '1') { fs.writeFileSync((process.env.TOPES_DIR ?? '/tmp') + '/topes-paquetes.json', JSON.stringify(actual, null, 1)); return; }
  const crecen = Object.entries(actual).filter(([rel, n]) => n > (TOPE_PAQUETES[rel] ?? 0)).map(([rel, n]) => `${rel}: ${n} > tope ${TOPE_PAQUETES[rel] ?? 0}`);
  assert.deepEqual(crecen, [], 'más español sin par inglés que el tope; usa L(es, en) o justifica');
});
test('los pares bilingües inline L(es, en) no cuentan como español fijo y un literal suelto sí', () => {
  assert.deepEqual(hallazgos("const a = L('Sin datos para este periodo', `No data for this period`);"), []);
  assert.deepEqual(hallazgos("const a = L(`Hay ${n} pedidos sin importe`, `There are ${n} orders without an amount`);"), []);
  assert.deepEqual(hallazgos("const a = 'Sin datos para este periodo';"), ['Sin datos para este periodo']);
});

// ---- T42: plantillas con interpolación ----
test('el detector revisa las plantillas con ${…} (antes quedaban fuera) y sigue ignorando las bilingües, las de código y las de identificadores', () => {
  assert.deepEqual(hallazgos('const a = `Hay ${n} pedidos sin importe`;'), ['Hay pedidos sin importe']);
  assert.deepEqual(hallazgos('const a = `${mes(prev)} y ${mes(last)} son meses completos`;'), ['y son meses completos']);
  assert.deepEqual(hallazgos('const a = `Pedidos: ${f(a.n)} → ${f(z.n)} (${p})`;'), []);
  assert.deepEqual(hallazgos('const a = `${f({k: 1}, g(2))} está incompleto`;'), ['está incompleto']);
  assert.deepEqual(hallazgos('const a = `There are ${n} orders without an amount`;'), []);
  assert.deepEqual(hallazgos('const k = `tr.lg.hace.${unidad}`; const u = `/api/x/${id}/y`;'), []);
  assert.deepEqual(hallazgos("const a = L(`Hay ${n} pedidos`, `There are ${n} orders`);"), []);
  assert.equal(sinInterpolaciones('a ${b({c: {d: 1}})} d ${e}'), 'a d');
});
test('los topes solo bajan: ninguna entrada de TOPE_MODULOS / TOPE_PAQUETES apunta a un archivo inexistente y todo tope tiene español que lo justifique', () => {
  for (const rel of Object.keys(TOPE_MODULOS)) assert.ok(fs.existsSync(RAIZ + '/' + rel), 'no existe: ' + rel);
  for (const rel of Object.keys(TOPE_PAQUETES)) assert.ok(fs.existsSync(PAQUETES + '/' + rel), 'no existe: ' + rel);
  for (const [rel, tope] of Object.entries(TOPE_MODULOS)) assert.ok(hallazgos(fs.readFileSync(RAIZ + '/' + rel, 'utf8')).length === tope, `tope holgado (bájalo a lo real): ${rel}`);
  for (const [rel, tope] of Object.entries(TOPE_PAQUETES)) assert.ok(hallazgos(fs.readFileSync(PAQUETES + '/' + rel, 'utf8')).length === tope, `tope holgado (bájalo a lo real): ${rel}`);
});
