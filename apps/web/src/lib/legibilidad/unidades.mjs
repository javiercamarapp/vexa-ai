// Qué cuenta cada cifra de volumen. UNA redacción para Resumen y Problemas: incidencias vs conversaciones vs grupos.
export const UNIDADES = Object.freeze({
  incidencias: 'Incidencias: cada mención clasificada de una categoría en las conversaciones del corte; una conversación puede sumar varias.',
  conversaciones: 'Conversaciones: conversaciones únicas del grupo, sin repetir.',
  grupos: 'Grupos: conversaciones parecidas agrupadas por la IA; una categoría puede tener varios grupos.',
});
/** Línea bajo la cifra de categorías: distingue incidencias (Resumen) de conversaciones por grupo (Problemas) y de lo oculto. */
export function lineaCategorias({categorias, ocultasCategorias = 0, unidad}) {
  const oc = ocultasCategorias > 0 ? ` (${ocultasCategorias} más solo tienen notificaciones automáticas, ocultas)` : '';
  const base = unidad === 'incidencias'
    ? `${categorias} categorías con incidencias${oc}. ${UNIDADES.incidencias}`
    : `${categorias} categorías entre los grupos visibles${oc}. ${UNIDADES.conversaciones} ${UNIDADES.grupos}`;
  return base;
}
