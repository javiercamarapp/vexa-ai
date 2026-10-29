// Contrato PURO (sin imports, seguro para el navegador) entre «Brechas de ingreso» y el flujo de recomendaciones. Ver docs/BRECHAS.md.
/**
 * CONTRATO con el flujo de recomendaciones (BUILD-FLUJO): convierte una brecha en el borrador de una recomendación. PURA, sin red ni base.
 * Devuelve {origen, clave, titulo, resumen, cuerpo, evidencia[], cobertura, impacto:{clase,usdMinor,texto}, supuestos[], estadoSugerido:'proposed', etiquetas[]}.
 * Nada de margen ni utilidad: el impacto es ingreso bruto. El flujo Proceder / Ajustar / Descartar vive en /recommendations; esta función solo prepara el texto.
 */
export function recomendacionDeBrecha(rec, {generadoEn = null, supuestos = [], idioma = 'es'} = {}) {
  const E = (es, en) => (idioma === 'en' ? en : es);
  if (!rec || typeof rec !== 'object' || !rec.id || !rec.titulo) throw Object.assign(new Error('brecha_invalida'), {code: 'brecha_invalida'});
  const lista = (rec.evidencia ?? []).map(x => String(x));
  const sup = (supuestos ?? []).map(x => String(x)).filter(Boolean);
  const cuerpo = [
    E(`Qué hacer: ${rec.accion}`, `What to do: ${rec.accion}`), E(`Por qué: ${rec.porque}`, `Why: ${rec.porque}`), E('Evidencia:', 'Evidence:'), ...lista.map(x => '- ' + x), E(`Cobertura: ${rec.cobertura}`, `Coverage: ${rec.cobertura}`),
    E(`Impacto de ingreso (${rec.impacto?.clase === 'estimated' ? 'Estimado' : 'Observado'}): ${rec.impacto?.texto ?? 'n/d'}`, `Revenue impact (${rec.impacto?.clase === 'estimated' ? 'Estimated' : 'Observed'}): ${rec.impacto?.texto ?? 'n/a'}`),
    ...(sup.length ? [E('Supuestos tecleados por quien lo prepara (no son hallazgos):', 'Assumptions typed by whoever prepares this (not findings):'), ...sup.map(x => '- ' + x)] : []),
    E('Todas las cifras son ingreso bruto observado; no hay costo ni margen por producto.', 'All figures are observed gross revenue; there is no cost or margin per product.'),
    generadoEn ? E(`Preparado desde Brechas de ingreso el ${String(generadoEn).slice(0, 10)}.`, `Prepared from Revenue gaps on ${String(generadoEn).slice(0, 10)}.`) : E('Preparado desde Brechas de ingreso.', 'Prepared from Revenue gaps.'),
  ].join('\n');
  return {origen: 'brechas-de-ingreso', clave: rec.id, tipoBrecha: rec.tipo, titulo: rec.titulo, resumen: rec.porque, cuerpo, evidencia: lista, cobertura: rec.cobertura,
    impacto: {clase: rec.impacto?.clase ?? 'observed', usdMinor: rec.impacto?.usdMinor ?? null, texto: rec.impacto?.texto ?? ''}, supuestos: sup, estadoSugerido: 'proposed', etiquetas: ['brechas-de-ingreso', rec.tipo, ...(rec.canal ? [rec.canal] : [])]};
}
