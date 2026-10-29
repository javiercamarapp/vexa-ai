// Traducción de textos fijos, grupo B (brechas, fuga de reembolsos, flujo de recomendaciones, puntos de dolor): paridad es/en, sin textos fijos en español en el código y reglas de la casa para el inglés.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {trBEs, trBEn} from '../src/lib/i18n/d-tr-b';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';
import {ESTADO_TXT, HOJA_TXT} from '../src/components/refunds/fuga-modelo.mjs';
import {NO_SE_SABE} from '../src/components/refunds/fuga-archivos.mjs';
import {TIPO_REC} from '../src/components/gaps/gaps-modelo.mjs';
import {PRIORIDAD_TXT, RESULTADO_TXT, ETAPA_TXT} from '../../../packages/recommendations/flujo.mjs';

const leer = (rel: string) => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const variables = (t: string) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const ES = trBEs as Record<string, string>, EN = trBEn as Record<string, string>;
const claves = Object.keys(ES);

test('d-tr-b: mismas claves tr.* en es y en, mismas {variables} y sin vacíos', () => {
  assert.deepEqual(Object.keys(EN).sort(), [...claves].sort());
  assert.ok(claves.length > 100, 'diccionario con contenido: ' + claves.length);
  for (const k of claves) {
    assert.match(k, /^tr\.[a-z]+\.[A-Za-z0-9]+$/, 'forma de la clave: ' + k);
    assert.ok(ES[k].trim() && EN[k].trim(), 'vacío: ' + k);
    assert.equal(variables(EN[k]), variables(ES[k]), 'variables distintas: ' + k);
  }
});

test('d-tr-b: es.ts y en.ts incorporan exactamente estos textos (ninguna clave pisada por otro diccionario)', () => {
  for (const k of claves) {
    assert.equal((es as Record<string, string>)[k], ES[k], 'es.ts distinto: ' + k);
    assert.equal((en as Record<string, string>)[k], EN[k], 'en.ts distinto: ' + k);
  }
});

test('d-tr-b: el inglés no lleva letras acentuadas del español, paréntesis ni emojis, y ningún texto lleva cifras escritas a mano', () => {
  for (const k of claves) {
    assert.doesNotMatch(EN[k], /[áéíóúüñÁÉÍÓÚÜÑ¿¡]/, 'acento en inglés: ' + k);
    assert.doesNotMatch(EN[k], /[()]/, 'paréntesis en inglés: ' + k);
    assert.doesNotMatch(EN[k], /\p{Extended_Pictographic}/u, 'emoji en inglés: ' + k);
    assert.doesNotMatch(ES[k], /\d/, 'cifra a mano en español: ' + k);
    assert.doesNotMatch(EN[k], /\d/, 'cifra a mano en inglés: ' + k);
  }
});

test('d-tr-b: las etiquetas traducidas conservan exactamente el español de los modelos que reemplazan', () => {
  const estado: Record<string, string> = {reembolsado: 'tr.fuga.estReembolsado', vencido: 'tr.fuga.estVencido', no_reembolsable: 'tr.fuga.estNoReemb', rechazado: 'tr.fuga.estRechazado', enviado: 'tr.fuga.estEnviado', otro: 'tr.fuga.estOtro', sin_estado: 'tr.fuga.estSin'};
  for (const [k, clave] of Object.entries(estado)) assert.equal(ES[clave].replace('{n}', '180'), (ESTADO_TXT as Record<string, string>)[k], k);
  const hoja: Record<string, string> = {garantiaHerramientas: 'tr.fuga.hojaGarHerr', garantiaPartes: 'tr.fuga.hojaGarPartes', etiquetas: 'tr.fuga.hojaEtiq'};
  for (const [k, clave] of Object.entries(hoja)) assert.equal(ES[clave], (HOJA_TXT as Record<string, string>)[k], k);
  assert.equal((es as Record<string, string>)['fuga.thReemb'], (HOJA_TXT as Record<string, string>).reembolsos);
  assert.equal(NO_SE_SABE.length, 5);
  NO_SE_SABE.forEach((x: string, i: number) => assert.equal(ES['tr.fuga.nss' + i], x, 'NO_SE_SABE ' + i));
  const tipo: Record<string, string> = {revisar_proveedor: 'tr.brecha.tipoProveedor', empujar: 'tr.brecha.tipoEmpujar', revisar_canal: 'tr.brecha.tipoCanal', cross_sell: 'tr.brecha.tipoCross'};
  for (const [k, clave] of Object.entries(tipo)) assert.equal(ES[clave], (TIPO_REC as Record<string, string>)[k], k);
  // Prioridad, resultado y etapa del flujo reutilizan las claves acc.* de d-recs: deben decir lo mismo que packages/recommendations.
  const e = es as Record<string, string>;
  assert.equal(e['acc.prioCritical'], PRIORIDAD_TXT.critical); assert.equal(e['acc.prioHigh'], PRIORIDAD_TXT.high); assert.equal(e['acc.prioNormal'], PRIORIDAD_TXT.normal);
  assert.equal(e['acc.resSi'], RESULTADO_TXT.yes); assert.equal(e['acc.resNo'], RESULTADO_TXT.no); assert.equal(e['acc.resParcial'], RESULTADO_TXT.partial);
  assert.equal(e['acc.etPropuesta'], ETAPA_TXT.propuesta); assert.equal(e['acc.etAjustada'], ETAPA_TXT.ajustada); assert.equal(e['acc.etAprobada'], ETAPA_TXT.aprobada);
  assert.equal(e['acc.etEnCurso'], ETAPA_TXT.en_curso); assert.equal(e['acc.etResultado'], ETAPA_TXT.resultado); assert.equal(e['acc.etDescartada'], ETAPA_TXT.descartada);
});

// Textos que se tradujeron y no deben reaparecer escritos a mano en el código de estos archivos.
const PROHIBIDOS: Record<string, string[]> = {
  'src/components/gaps/gaps-bloques.tsx': ['El puente necesita pedidos', 'Dónde gano', 'Dónde pierdo', 'Cierra esta brecha: recomendaciones', 'Ingreso bruto (USD)', 'Copiar texto', 'Ir a Recomendaciones', 'poca base', 'Texto preparado', 'Revisar con proveedor', 'Participación por canal', 'Categorías mencionadas'],
  'src/components/gaps/gaps-recs.tsx': ['Rovaq no propone supuestos', 'Incluir este estimado', 'Falta tu supuesto', 'Estimado con tus supuestos', 'Dinero recuperable por reclamo'],
  'src/components/gaps/gaps-familias.tsx': ['Avance del análisis del histórico'],
  'src/components/gaps/use-gaps.ts': ['No significa que no haya', 'Tu rol no tiene acceso'],
  'src/components/refunds/use-fuga.ts': ['No significa que no haya', 'Tu rol no tiene acceso'],
  'src/components/refunds/fuga-bloques.tsx': ['No hay reembolsos con SKU', 'Elige un SKU de la tabla', 'Paquete de evidencia para proveedor', 'Cola de vencidos o negados', 'Contactos que repiten', 'Motivos con más solicitudes negadas', 'Sin meses con reembolsos registrados', 'Qué se sabe'],
  'src/components/refunds/fuga-partes.tsx': ['Líneas vendidas: no disponibles ahora', 'tickets repiten un contacto', 'sin reembolsar', 'Tracker de Excel', 'Motivo de contacto'],
  'src/components/refunds/fuga-intensidad.tsx': ['Sin meses con reembolsos registrados', 'Posible hueco de exportación', 'Ver los números de', 'Best Buy no aparece'],
  'src/components/refunds/fuga-tarjeta.tsx': ['USD devueltos', 'Ver el detalle', 'Fuga de reembolsos', 'Sin reembolsos cargados'],
  'src/components/refunds/fuga-estimador.tsx': ['Rovaq no propone supuestos', 'Costo por contacto', 'Escribe tu supuesto', 'Falta tu supuesto', 'Supuestos tuyos'],
  'src/components/refunds/fuga-esqueleto.tsx': ['Cargando fuga de reembolsos'],
  'src/components/recommendations/flujo-vista.tsx': ['Sin comparación antes/después', 'Fecha de compromiso', 'Aprobada por', 'Persona del equipo', 'Línea de tiempo', 'Comentario de la aprobación'],
  'src/components/recommendations/flujo-acciones.tsx': ['Proceder con esta recomendación', 'Guardar ajuste', 'Registrar el resultado', 'Marcar en curso', 'Elige una persona', 'Cancelar', 'Para continuar'],
  'src/components/recommendations/flujo-borradores.tsx': ['No se ha enviado nada', 'Vista previa', 'Preparando borradores', 'Borradores de la acción', 'No se pudieron verificar las citas'],
  'src/components/pain-points/burbujas.tsx': ['Cómo cuadra', 'Leyenda del mapa', 'Observado: contorno sólido', 'Temas sin cifra', 'puntos pequeños', 'Sin puntos de dolor con cifra'],
  'src/components/pain-points/detalle.tsx': ['Ver más filas', 'Mismo SKU y mes', 'Qué no sabemos', 'Lectura de IA', 'Sin monto', 'Filas que sustentan'],
  'src/components/pain-points/lectura-ia.tsx': ['Sin lectura todavía', 'Análisis al día', 'Tope semanal', 'Completar análisis', 'Severidad baja', 'No se pudo analizar ahora'],
};
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('el código de los archivos del grupo B no vuelve a llevar escritos a mano los textos traducidos', () => {
  const reaparecen: string[] = [];
  for (const [archivo, frases] of Object.entries(PROHIBIDOS)) {
    const src = sinComentarios(leer(archivo));
    for (const f of frases) if (src.includes(f)) reaparecen.push(archivo + ' -> ' + f);
  }
  assert.deepEqual(reaparecen, []);
});

test('los componentes de cliente del grupo B leen el idioma con useT y ningún texto traducido usa una clave inexistente', () => {
  const todas = new Set(Object.keys(es));
  for (const archivo of Object.keys(PROHIBIDOS)) {
    const src = leer(archivo);
    for (const m of src.matchAll(/\b(?:t|tx)\(\s*(?:[^'"`()]*\?\s*)?'((?:tr|acc|fuga|brechas|vista|pp|comun|ag|conx)\.[\w.]+)'/g)) assert.ok(todas.has(m[1]), archivo + ': clave inexistente ' + m[1]);
    if (/\b(?:t|tx)\('/.test(src)) assert.match(src, /useT\b|Traductor/, archivo + ' usa t() sin useT ni recibirlo');
  }
});
