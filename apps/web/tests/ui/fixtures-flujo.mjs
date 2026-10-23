// Fixtures SINTÉTICOS del flujo de aprobación (todo ficticio): decora las recomendaciones de fixtures.mjs con su flujo para la auditoría visual.
//   ?variant=flujo         -> una recomendación en cada etapa (propuesta, ajustada, aprobada, en curso, con resultado, descartada)
//   ?variant=flujo-viewer  -> igual pero el rol solo puede leer
//   ?variant=flujo-apagado -> la migración del flujo aún no está aplicada (flowAvailable=false)
//   (sin variante)         -> flujo disponible con la recomendación de siempre en «propuesta»
const iso = d => `2026-10-${String(d).padStart(2, '0')}T15:00:00.000Z`;
export function decorarRecomendaciones(data, variant, {u}) {
  const apagado = variant === 'flujo-apagado', viewer = variant === 'flujo-viewer', rol = viewer ? 'viewer' : 'owner';
  const miembros = [{id: u(9), role: 'owner'}, {id: u(10), role: 'analyst'}, {id: u(11), role: 'operator'}];
  const base = data.items[0], vacio = {available: !apagado, role: rol, events: [], etapa: 'propuesta', interventionId: null};
  if (!variant?.startsWith('flujo')) return {...data, members: miembros, flowAvailable: true, items: data.items.map(i => ({...i, flow: vacio}))};
  const ev = (n, kind, o = {}) => ({id: u(7000 + n), kind, recommendationVersion: 1, actorId: u(10), ownerId: null, dueDate: null, priority: null, outcome: null, note: null, comment: null, interventionId: null, comparison: null, createdAt: iso(10 + n), ...o});
  const hist = (...extra) => [{version: 1, status: 'proposed', action: 'Inicial', preconditions: [], rationale: 'Inicial', ownerId: null, reason: 'Propuesta condicionada generada desde evidencia autorizada.', actorId: u(9), createdAt: iso(8)}, ...extra];
  const aprobadaEv = n => ev(n, 'approved', {ownerId: u(10), dueDate: '2026-11-06', comment: 'Aprobado para pedir revisión de lote al proveedor.', interventionId: u(4010 + n), actorId: u(9)});
  const sets = [
    {k: 'propuesta', t: 'Order: Spare Parts', p: 'critical', ev: [], extra: {}},
    {k: 'ajustada', t: 'Shipping: Delivery Not Received', p: 'high', ev: [ev(1, 'adjusted', {recommendationVersion: 2, priority: 'high', comment: 'Se acota la acción al transportista con más reclamos.'})], extra: {version: 2, history: hist({version: 2, status: 'proposed', action: 'Acota', preconditions: [], rationale: 'Acota', ownerId: null, reason: 'Se acota la acción al transportista con más reclamos.', actorId: u(10), createdAt: iso(11)})}},
    {k: 'aprobada', t: 'Warranty: Battery Replacement', p: 'high', ev: [aprobadaEv(2)], extra: {ownerId: u(10), drafts: [{id: u(4012), status: 'draft', version: 1, hypothesis: 'Inspección previa del empaque', createdAt: iso(12), executionEnabled: false}]}},
    {k: 'en_curso', t: 'Return: Defective Product', p: 'normal', ev: [aprobadaEv(3), ev(4, 'started', {comment: 'Se envió el paquete al proveedor.'})], extra: {ownerId: u(10), drafts: [{id: u(4013), status: 'draft', version: 1, hypothesis: 'Revisión de lote con el proveedor', createdAt: iso(13), executionEnabled: false}]}},
    {k: 'resultado', t: 'Warranty: Tool Replacement', p: 'high', ev: [aprobadaEv(5), ev(6, 'started'), ev(7, 'resolved', {outcome: 'partial', note: 'El proveedor corrigió un lote; falta el segundo, se revisará en noviembre.', comparison: {antesMinor: '1250000', despuesMinor: '830000', deltaMinor: '-420000', moneda: 'USD', exponente: 2, completa: true, razones: [], publicacionAntes: u(900), publicacionDespues: u(901), rotulo: 'Asociación temporal, no causa: el cambio entre los dos periodos puede deberse a otros factores.'}})], extra: {ownerId: u(10)}},
    {k: 'descartada', t: 'Feedback: Negative', p: 'normal', ev: [], extra: {status: 'dismissed', version: 2, history: hist({version: 2, status: 'dismissed', action: 'x', preconditions: [], rationale: 'x', ownerId: null, reason: 'Ya se corrigió con el proveedor el mes pasado.', actorId: u(9), createdAt: iso(14)})}},
  ];
  const items = sets.map((s, i) => ({...base, id: u(320 + i), title: s.t, priority: s.p, ownerId: null, drafts: [], history: hist(), version: 1, ...s.extra, flow: apagado ? vacio : {available: true, role: rol, events: s.ev, etapa: s.k === 'en_curso' ? 'en_curso' : s.k, interventionId: s.ev.find(e => e.kind === 'approved')?.interventionId ?? null}, canMutate: !viewer}));
  return {...data, members: miembros, canPropose: !viewer, flowAvailable: !apagado, items};
}
