// Modelo SIMULADO y determinista: enruta por palabras clave a herramientas y redacta con los resúmenes ya calculados.
// Sirve para desarrollo, pruebas y fixtures. No llama a ningún proveedor ni usa datos reales. El modelo real (OpenRouter u otro)
// debe implementar el mismo contrato {plan, compose, estimateMicro}; ver NOTAS.md.
const MONTHS = {enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06', julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10', noviembre: '11', diciembre: '12'};
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const currencyOf = q => (/\busd\b|dolar(es)?\s+(americano|estadounidense)|dolares/.test(q) ? 'USD' : /\bcad\b|canadi/.test(q) ? 'CAD' : /\bmxn\b|pesos?\b/.test(q) ? 'MXN' : undefined);
const monthOf = q => { const m = q.match(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(20\d\d)\b/); return m ? `${m[2]}-${MONTHS[m[1]]}` : undefined; };
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function createSimulatedModel({scope, costMicroPerTurn = 0} = {}) {
  return {
    name: 'simulado',
    estimateMicro: () => costMicroPerTurn,
    async plan({question, tools}) {
      const q = norm(question), has = name => tools.some(t => t.name === name), calls = [];
      const add = (tool, args = {}) => { if (has(tool) && !calls.some(c => c.tool === tool)) calls.push({tool, args}); };
      if (scope === 'platform') {
        const id = question.match(UUID)?.[0];
        if (/miembro|invitaci/.test(q) && id) add('miembros_resumen', {organizationId: id});
        if (/(salud|estado)/.test(q) && id) add('salud_organizacion', {organizationId: id});
        if (/critic/.test(q)) add('organizaciones', {health: 'critical'}); else if (/atencion|salud|organizacion/.test(q)) add('organizaciones', /atencion/.test(q) ? {health: 'attention'} : {});
        if (/fuente|cobertura|import|tracker|adjunto|ledger|asociaci/.test(q)) add('cobertura_fuentes', id ? {organizationId: id} : {});
        if (/proceso|cola|fallid|atasc|job/.test(q)) add('procesos', /fallid/.test(q) ? {state: 'failed'} : {});
        if (/\bia\b|gasto|costo|tope|openrouter|presupuesto/.test(q)) add('costos_ia');
        if (/alerta|timeout|cron|disco/.test(q)) add('alertas_operativas');
        if (/bitacora|auditor|se hizo/.test(q)) add('bitacora', {limit: 10});
        if (!calls.length) add('organizaciones');
      } else {
        const currency = currencyOf(q), month = monthOf(q);
        if (/como se calcul|que significa|glosario|define|definicion/.test(q)) add('explicar_cifra', {term: /base/.test(q) ? 'Base económica' : /cobertura/.test(q) ? 'Cobertura' : /tasa/.test(q) ? 'Tasa de reembolso' : /exposicion/.test(q) ? 'Exposición' : 'Observado'});
        if (/proyec|pronostic|estimad|tendencia/.test(q)) add('proyeccion', {...(currency ? {currency} : {}), ...(/pedido/.test(q) ? {metric: 'pedidos'} : /ingreso|venta/.test(q) ? {metric: 'ingresos'} : {})});
        if (/alerta|anomal|caida/.test(q)) add('alertas');
        if (/exposic|problema/.test(q)) add('exposicion_problemas');
        if (/calidad|sin importe|no traen|faltan|sin moneda|duplicad|mala calidad/.test(q)) add('calidad_datos');
        if (/canal|mezcla|amazon|walmart|shopify|mirakl|best buy|marketplace/.test(q)) add('mezcla_canal', currency ? {currency} : {});
        if (/compar|mes anterior|contra el mes|variacion|crec/.test(q)) add('comparativa_mes', currency ? {currency} : {});
        if (!calls.length || /cerro|resumen|como (nos )?(fue|va)/.test(q)) add('resumen_mes', {...(currency ? {currency} : {}), ...(month ? {month} : {})});
      }
      return {calls: calls.slice(0, 4), usage: {costMicro: 0}};
    },
    async compose({results}) {
      const parts = results.results.map(r => r.data.summary);
      return {text: 'Esto es lo que encontré en las cifras ya calculadas:\n\n' + parts.join('\n\n'), usage: {costMicro: costMicroPerTurn}};
    },
  };
}
