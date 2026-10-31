// Traducción grupo C (paneles de intervenciones, briefs, análisis, economía y consola de plataforma): paridad es/en de d-tr-c, sin texto fijo en español en los archivos migrados y reglas de la casa para el inglés.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {trCEs, trCEn} from '../src/lib/i18n/d-tr-c';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';

const leer = (rel: string) => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const variables = (texto: string) => [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const ES = trCEs as Record<string, string>, EN = trCEn as Record<string, string>;

test('d-tr-c: las claves tr.* son idénticas en es y en, sin vacíos, con las mismas {variables}', () => {
  const ke = Object.keys(ES).sort(), kn = Object.keys(EN).sort();
  assert.ok(ke.length > 500, 'diccionario con contenido: ' + ke.length);
  assert.deepEqual(kn.filter((k) => !ke.includes(k)), [], 'claves solo en inglés');
  assert.deepEqual(ke.filter((k) => !kn.includes(k)), [], 'claves solo en español');
  for (const k of ke) {
    assert.ok(k.startsWith('tr.'), 'prefijo tr.: ' + k);
    assert.ok(ES[k].trim() && EN[k].trim(), 'vacío: ' + k);
    assert.equal(variables(EN[k]), variables(ES[k]), 'variables distintas: ' + k);
    assert.equal((es as Record<string, string>)[k], ES[k], 'es.ts incorpora ' + k);
    assert.equal((en as Record<string, string>)[k], EN[k], 'en.ts incorpora ' + k);
  }
});

test('d-tr-c: el inglés no lleva letras acentuadas del español, signos invertidos ni paréntesis, y las cifras entran por {variable}', () => {
  for (const [k, v] of Object.entries(EN)) {
    if (k === 'tr.eval.locale') continue;
    assert.doesNotMatch(v, /[áéíóúñüÁÉÍÓÚÑÜ¿¡]/, 'acento en inglés: ' + k);
    assert.doesNotMatch(v, /[()]/, 'paréntesis en inglés: ' + k);
    assert.doesNotMatch(v, /\p{Extended_Pictographic}/u, 'emoji en inglés: ' + k);
    assert.doesNotMatch(v, /(^|[^{\w.-])\d{2,}/, 'cifra escrita a mano en inglés: ' + k);
  }
  for (const [k, v] of Object.entries(ES)) {
    assert.doesNotMatch(v, /\p{Extended_Pictographic}/u, 'emoji en español: ' + k);
    // Las claves de ejemplo numérico ya reciben su cifra por variable; ningún texto debe llevar una cifra fija de dos o más dígitos.
    assert.doesNotMatch(v.replace(/\{\w+\}/g, ''), /(^|[^\w.-])\d{2,}/, 'cifra escrita a mano en español: ' + k);
  }
});

// Textos fijos en español que se tradujeron y no deben reaparecer en el código fuente de cada archivo (lista corta y explícita).
const PROHIBIDOS: Record<string, string[]> = {
  'src/components/briefs/panel.tsx': ['Tres prioridades', 'Qué hacer', 'Límites e interpretación', 'Identidad de la versión', 'Decisiones y acciones registradas', 'Sin lectura destacada', 'Cambios entre periodos'],
  'src/components/interventions/panel.tsx': ['Plan de medición', 'Guardar plan', 'Avanzar intervención', 'Reasignar intervención', 'Cancelar intervención', 'Comparación antes y después', 'Reembolsos observados'],
  'src/components/evidence-panel.tsx': ['Evidencia del análisis', 'Citas por hallazgo', 'Menciones respaldadas', 'Volver a análisis'],
  'src/components/extraction-panel.tsx': ['Solicitar análisis', 'Límites y conciliación', 'Conciliar costo', 'Reservas pendientes de conciliación', 'Requieren atención'],
  'src/components/association-panel.tsx': ['Vínculos entre conversaciones y clientes', 'Evidencia de origen', 'Decisión del administrador del espacio', 'Aprobar lote de origen revisado'],
  'src/components/candidates-panel.tsx': ['Candidatos de extracción', 'Confirmación humana', 'Historial y rollback', 'Registrar recibo del custodio'],
  'src/components/evaluation-panel.tsx': ['Evaluación histórica', 'Nueva cohorte', 'Motivos de exclusión', 'Guardar comentario versionado'],
  'src/components/migration-comparison.tsx': ['Comparación de migración', 'Congelar corte', 'Cobertura por canal', 'Delta comparable'],
  'src/components/migration-aliases.tsx': ['Aliases de conversaciones', 'Preparar propuesta', 'Confirmar alias', 'Deshacer alias'],
  'src/components/economic-panel.tsx': ['Registro económico y componentes separados', 'Consultar libro de registros', 'Guardar registro económico', 'Escenarios futuros, no pronósticos calibrados'],
  'src/components/economic-exposure-panel.tsx': ['Exposición por problemas', 'Clientes únicos vinculados', 'Guardar equivalencia de órdenes', 'Guardar revisión de cobertura'],
  'src/components/economic-snapshot-panel.tsx': ['Snapshots publicados', 'Preparar snapshot', 'Sí, publicar', 'Descargar JSON'],
  'src/components/economic-import-panel.tsx': ['Cargar órdenes y reembolsos', 'Archivo económico JSON', 'Pausar carga', 'Confirmar este archivo'],
  'src/components/economic-money-panel.tsx': ['Monedas originales y conversión explícita', 'Guardar moneda', 'Guardar tipo de cambio', 'Catálogo monetario aprobado'],
  'src/components/economic-priority-panel.tsx': ['Prioridad explicable', 'Política versionada', 'Calcular prioridad', 'Registrar accionabilidad'],
  'src/components/embedding-budget-panel.tsx': ['Consumo de agrupación', 'Guardar límite de agrupación', 'Conciliar costo de agrupación'],
  'src/components/platform/platform-nav.tsx': ['Fuentes y cargas', 'Costos de IA', 'Seguridad de la cuenta', 'Gestionar'],
  'src/components/platform/data-table.tsx': ['Sin resultados', 'Limpiar selección', 'Mostrar más', 'desplazamiento horizontal'],
  'src/components/platform/admin-tools.tsx': ['Cambiar de cliente', 'Iniciar modo soporte', 'Abrir organización', 'Motivo (obligatorio)'],
  'src/app/(app)/platform/layout.tsx': ['Saltar al contenido', 'Consola de administración', 'Cerrar sesión', 'Mi organización'],
};

test('los archivos migrados no vuelven a llevar texto fijo en español de la lista', () => {
  for (const [archivo, textos] of Object.entries(PROHIBIDOS)) {
    const fuente = leer(archivo);
    for (const texto of textos) assert.ok(!fuente.includes(texto), `${archivo} vuelve a tener el texto fijo «${texto}»`);
  }
});

test('los archivos migrados usan el traductor del idioma activo', () => {
  for (const archivo of Object.keys(PROHIBIDOS)) {
    if (archivo === 'src/app/(app)/platform/layout.tsx') { assert.match(leer(archivo), /traductor\(idioma\)/, archivo); continue; }
    assert.match(leer(archivo), /useT\(\)/, archivo + ' debe usar useT()');
  }
});

test('la consola de plataforma no cambia <html lang>: el layout usa IdiomaLocal y no IdiomaProvider', () => {
  const layout = leer('src/app/(app)/platform/layout.tsx');
  assert.match(layout, /IdiomaLocal/);
  assert.doesNotMatch(layout, /IdiomaProvider/);
});
