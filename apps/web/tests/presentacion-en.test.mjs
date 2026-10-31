// Capa de presentación en inglés: Acciones, Informe ejecutivo, Histórico, Explorador y Análisis no emiten español cuando el traductor es inglés,
// y siguen en español sin traductor. Los textos guardados de cada recomendación son datos y no se tocan.
import test from 'node:test';
import assert from 'node:assert/strict';
import {textoLegible, etiquetaCausal} from '../src/lib/legibilidad/recomendaciones-vista.mjs';
import {estadoAccion, tituloEs} from '../src/lib/legibilidad/brief.mjs';
import {motivoVinculo, detalleAsociaciones, estadoProcesamiento, tituloLote} from '../src/lib/history/historico.mjs';
import {avisoTerceros, avisoImporte, textoConversaciones, textoCitas, resumenResultados} from '../src/lib/legibilidad/explorador.mjs';
import {etiquetaSeveridad} from '../src/lib/legibilidad/problemas-catalogo.mjs';
import {severidadDe} from '../src/lib/legibilidad/hallazgos.mjs';

const en = (clave) => (clave === 'tr.lg.idioma' ? 'en' : clave);
const ACENTOS = /[áéíóúñ¿¡«»]/i;
const PAL = /\b(de|del|la|las|los|el|para|por|sin|con|una?|que|se|su|más|hay|datos|todavía|estado|causal|aún)\b/gi;
const espanol = (t) => ACENTOS.test(t) || (t.match(PAL) ?? []).length >= 2;

test('textoLegible: en inglés conserva la taxonomía original y traduce solo «Estado causal»; en español sigue igual', () => {
  const guardado = 'Pedido: revisar Order: Spare Parts. Estado causal: unassessed.';
  assert.equal(textoLegible(guardado, en), 'Pedido: revisar Order: Spare Parts. Causal status: not assessed.');
  assert.match(textoLegible('Estado causal: hypothesis. los datos', en), /^Causal status: probable cause, not confirmed\./);
  assert.match(textoLegible(guardado), /Estado causal: sin evaluar\./); assert.match(textoLegible('Revisar Order: Spare Parts'), /Pedido: Repuestos|Pedido: /);
  assert.equal(textoLegible(null, en), null); assert.equal(textoLegible('', en), '');
  assert.equal(etiquetaCausal('hypothesis', en), 'Probable cause, not confirmed'); assert.equal(etiquetaCausal('hypothesis'), 'Causa probable, no confirmada');
  assert.equal(etiquetaCausal('desconocido', en), 'desconocido');
});
test('Informe ejecutivo: estados de acción y títulos de categoría en inglés', () => {
  assert.deepEqual(['proposed', 'approved', 'executing', 'closed', 'cancelled', 'dismissed', 'draft'].map((s) => estadoAccion(s, en)), ['Proposed', 'Approved', 'In progress', 'Closed', 'Canceled', 'Dismissed', 'Draft']);
  assert.equal(estadoAccion('proposed'), 'Propuesta');
  assert.equal(tituloEs('Shipping: Damaged in Transit', en), 'Shipping: Damaged in Transit'); assert.notEqual(tituloEs('Shipping: Damaged in Transit'), 'Shipping: Damaged in Transit');
});
test('Histórico: banner, lotes y motivos de vínculo en inglés', () => {
  for (const [lotes, lista] of [[0, true], [0, false], [3, true], [3, false]]) { const e = estadoProcesamiento({ lotes, lista }, en); assert.ok(!espanol(e.titulo) && !espanol(e.texto), JSON.stringify(e)); assert.equal(e.puedeAutorizar, lista); }
  assert.equal(estadoProcesamiento({ lotes: 0, lista: true }, en).titulo, 'The history has not been processed yet.');
  assert.equal(estadoProcesamiento({ lotes: 0, lista: true }).titulo, 'Aún no se ha procesado el histórico.');
  assert.equal(tituloLote('2026-10-18T10:00:00Z', en), 'Batch of Oct 18, 2026'); assert.equal(tituloLote('2026-10-18T10:00:00Z'), 'Lote del 18 oct 2026');
  assert.equal(tituloLote(null, en), 'Batch with no date'); assert.equal(tituloLote('x'), 'Lote sin fecha');
  for (const c of ['UNIQUE_EXPLICIT_BRIDGE', 'ENDPOINT_UNRESOLVED', 'EVIDENCE_CONFLICT', 'OWNER_DECISION', 'SOURCE_RETAINED', 'RETENTION_POLICY_REQUIRED', 'RETENTION_SCOPE_LIMIT', 'OTRO_CODIGO']) { assert.ok(!espanol(motivoVinculo(c, en)), c); assert.notEqual(motivoVinculo(c, en), motivoVinculo(c)); }
  assert.equal(motivoVinculo('', en), '');
  assert.equal(detalleAsociaciones('117,719 hechos (resueltos 15,189 · pendientes 102,530 · por revisar 0 · retenidos 0)', en), '117,719 relations (linked 15,189 · unidentified 102,530 · to review 0 · held 0)');
  assert.match(detalleAsociaciones('1 hechos (resueltos 1)'), /relaciones \(vinculadas 1\)/);
});
test('Explorador y Análisis: avisos, conteos, resumen de resultados y severidades en inglés', () => {
  assert.ok(!espanol(avisoTerceros(en)) && !espanol(avisoImporte(en))); assert.match(avisoTerceros(), /^El texto está redactado/); assert.match(avisoImporte(), /^El importe por problema/);
  assert.equal(textoConversaciones(1, en), '1 conversation'); assert.equal(textoConversaciones(1200, en), '1,200 conversations'); assert.equal(textoConversaciones(2), '2 conversaciones'); assert.equal(textoConversaciones(null, en), null);
  assert.equal(textoCitas(3, en), '3 distinct quotes'); assert.equal(textoCitas(1), '1 cita distinta');
  assert.equal(resumenResultados({ total: 2, texto: 'late', estado: 'partial' }, en), '2 problems match with "late" and partial coverage.');
  assert.equal(resumenResultados({ total: 1 }, en), '1 problem matches.'); assert.equal(resumenResultados({ total: 2, texto: 'x' }), '2 problemas coinciden con «x».');
  assert.deepEqual(['critical', 'high', 'medium', 'low'].map((s) => etiquetaSeveridad(s, en)), ['Critical', 'High', 'Medium', 'Low']); assert.equal(etiquetaSeveridad('critical'), 'Crítica'); assert.equal(etiquetaSeveridad(null, en), null);
  assert.deepEqual(['low', 'medium', 'high', 'critical', 'unknown'].map((s) => severidadDe(s, en)), ['Low', 'Medium', 'High', 'Critical', 'Undetermined']); assert.equal(severidadDe('unknown'), 'Sin determinar');
});
