// Contrato PURO (sin imports, seguro para el navegador) entre «Brechas de ingreso» y el flujo de recomendaciones. Ver docs/BRECHAS.md.
/**
 * CONTRATO con el flujo de recomendaciones (BUILD-FLUJO): convierte una brecha en el borrador de una recomendación. PURA, sin red ni base.
 * Devuelve {origen, clave, titulo, resumen, cuerpo, evidencia[], cobertura, impacto:{clase,usdMinor,texto}, supuestos[], estadoSugerido:'proposed', etiquetas[]}.
 * Nada de margen ni utilidad: el impacto es ingreso bruto. El flujo Proceder / Ajustar / Descartar vive en /recommendations; esta función solo prepara el texto.
 */
export function recomendacionDeBrecha(rec, {generadoEn = null, supuestos = []} = {}) {
  if (!rec || typeof rec !== 'object' || !rec.id || !rec.titulo) throw Object.assign(new Error('brecha_invalida'), {code: 'brecha_invalida'});
  const lista = (rec.evidencia ?? []).map(x => String(x));
  const sup = (supuestos ?? []).map(x => String(x)).filter(Boolean);
  const cuerpo = [
    `Qué hacer: ${rec.accion}`, `Por qué: ${rec.porque}`, 'Evidencia:', ...lista.map(x => '- ' + x), `Cobertura: ${rec.cobertura}`,
    `Impacto de ingreso (${rec.impacto?.clase === 'estimated' ? 'Estimado' : 'Observado'}): ${rec.impacto?.texto ?? 'n/d'}`,
    ...(sup.length ? ['Supuestos tecleados por quien lo prepara (no son hallazgos):', ...sup.map(x => '- ' + x)] : []),
    'Todas las cifras son ingreso bruto observado; no hay costo ni margen por producto.', generadoEn ? `Preparado desde Brechas de ingreso el ${String(generadoEn).slice(0, 10)}.` : 'Preparado desde Brechas de ingreso.',
  ].join('\n');
  return {origen: 'brechas-de-ingreso', clave: rec.id, tipoBrecha: rec.tipo, titulo: rec.titulo, resumen: rec.porque, cuerpo, evidencia: lista, cobertura: rec.cobertura,
    impacto: {clase: rec.impacto?.clase ?? 'observed', usdMinor: rec.impacto?.usdMinor ?? null, texto: rec.impacto?.texto ?? ''}, supuestos: sup, estadoSugerido: 'proposed', etiquetas: ['brechas-de-ingreso', rec.tipo, ...(rec.canal ? [rec.canal] : [])]};
}
