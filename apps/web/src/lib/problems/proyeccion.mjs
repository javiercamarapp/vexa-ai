// Lo que el navegador recibe de un problema (N7, QA-2 del 23-oct): antes /api/problems/{id} devolvía 32 KB con los ids de embeddings, el modelo y la procedencia
// completa de cada versión (incluida una copia de TODOS los miembros por versión), y /api/problems entregaba los ~15 mil ids de miembros a cualquier rol.
// Ahora: cifras (conteos) para todos; ids de miembros y datos técnicos del espacio vectorial solo para quien puede reestructurar (propietario), que los
// necesita para dividir o unir grupos; y la historia sin la copia de miembros de cada versión.
const OPERACION = ['operation', 'reason', 'jobId', 'children'];
const cuenta = v => (Array.isArray(v) ? v.length : 0);
export function proyectarHistoria(history) {
  return (Array.isArray(history) ? history : []).map(h => {
    const origen = h?.provenance && typeof h.provenance === 'object' ? h.provenance : {};
    const provenance = {};
    for (const k of OPERACION) if (origen[k] !== undefined) provenance[k] = origen[k];
    return {id: h.id, version: h.version, provenance};
  });
}
/** auditoria = true solo para quien puede reestructurar problemas (propietario). */
export function proyectarProblema(p, {auditoria = false} = {}) {
  const salida = {
    id: p.id, label: p.label, version: p.version, state: p.state, outlier: p.outlier === true,
    embeddingCount: cuenta(p.embeddingIds), conversationCount: cuenta(p.conversationIds), orderCount: cuenta(p.orderIds),
    embeddingIds: [], conversationIds: [], orderIds: [],
  };
  if (auditoria) Object.assign(salida, {modelId: p.modelId, dimensions: p.dimensions, embeddingVersion: p.embeddingVersion, embeddingIds: p.embeddingIds ?? [], conversationIds: p.conversationIds ?? [], orderIds: p.orderIds ?? []});
  if (p.verification) salida.verification = p.verification;
  if (Array.isArray(p.history)) salida.history = proyectarHistoria(p.history);
  return salida;
}
