// SQL de las señales del checklist: solo EXISTS acotados por tenant (parar en la primera fila) y un conteo sobre `memberships` (decenas de filas).
// Nada recorre pedidos, asientos ni mensajes: el costo no crece con el volumen de datos. Cada rol consulta solo lo que su checklist usa.
const SENAL = Object.freeze({
  conexion_activa: "EXISTS(SELECT 1 FROM public.connections WHERE tenant_id=$1 AND status='active')",
  conexion_con_problema: "EXISTS(SELECT 1 FROM public.connections WHERE tenant_id=$1 AND status IN ('reconnect_required','failed'))",
  historial_importado: "EXISTS(SELECT 1 FROM public.imports WHERE tenant_id=$1 AND state IN ('succeeded','partial'))",
  corte_publicado: "EXISTS(SELECT 1 FROM public.metric_snapshots WHERE tenant_id=$1 AND status='published')",
  equipo_invitado: "(SELECT count(*) FROM public.memberships WHERE tenant_id=$1 AND status='active')>=2",
  accion_propuesta: "EXISTS(SELECT 1 FROM public.recommendations WHERE tenant_id=$1 AND status IN ('proposed','accepted'))",
  hay_intervenciones: "EXISTS(SELECT 1 FROM public.interventions WHERE tenant_id=$1)",
  resultado_registrado: "EXISTS(SELECT 1 FROM public.intervention_results WHERE tenant_id=$1)",
  // Solo /setup (propietario). EXISTS acotados: paran en la primera fila; ninguno cuenta ni agrupa el libro (un count(distinct) sobre el libro tarda más de un segundo).
  pedidos_cargados: "EXISTS(SELECT 1 FROM public.economic_ledger_entries WHERE tenant_id=$1 AND kind='order')",
  pedidos_ligados: "EXISTS(SELECT 1 FROM public.economic_order_customers WHERE tenant_id=$1 AND customer_key IS NOT NULL)",
});
/** Señales que necesita el checklist de cada rol de organización (las del resto no se consultan). */
export const SENALES_POR_ROL = Object.freeze({
  owner: ['conexion_activa', 'conexion_con_problema', 'historial_importado', 'corte_publicado', 'equipo_invitado'],
  analyst: ['corte_publicado'],
  operator: ['accion_propuesta', 'hay_intervenciones', 'resultado_registrado'],
  viewer: [],
});
/** Señales que necesita la pantalla /setup de cada rol: las del checklist más las de los pasos que el rol sí puede hacer. */
export const SENALES_SETUP_POR_ROL = Object.freeze({
  owner: [...SENALES_POR_ROL.owner, 'pedidos_cargados', 'pedidos_ligados'],
  analyst: ['corte_publicado', 'historial_importado', 'pedidos_ligados'],
  operator: [...SENALES_POR_ROL.operator],
  viewer: [],
});
/** Consulta única (un viaje) para el rol, o null si su checklist no usa señales. El único parámetro es el tenant. `tabla` = SENALES_POR_ROL (checklist) o SENALES_SETUP_POR_ROL (/setup). */
export function consultaDeSenales(rol, tabla = SENALES_POR_ROL) {
  const claves = tabla[rol] ?? [];
  if (!claves.length) return null;
  return { claves, texto: 'SELECT ' + claves.map((k) => `${SENAL[k]} AS ${k}`).join(', ') };
}
