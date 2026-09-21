import {validateMoney,formatMoney,formatMinorUnits,MoneyContractError} from './money.mjs';
/** Explicit projection; no coercion of monetary values to Number and no subtotal-as-total. */
export function adaptMoneyMetric(metric,{tenantId,catalog,scope,metricId,grain='order',additive=false,provenance=[]}){
 if(metric&&Object.hasOwn(metric,'amount_minor')){
  if(metric.tenant_id!==tenantId)throw new MoneyContractError('TENANT_MISMATCH');
  return validateMoney(metric,catalog);
 }
 const amount=metric.amountMinor,subtotal=metric.knownSubtotalMinor??(metric.status==='modeled'?amount:null);
 const known=metric.knownCount??(amount===null?0:1),eligible=metric.totalCount??1;
 const reasons=[...new Set(metric.missingReasons??[])];
 const complete=amount!==null&&known===eligible&&reasons.length===0;
 const state=complete?'complete':subtotal!==null?'partial':'unavailable';if(!complete&&!reasons.length)reasons.push('AMOUNT_OR_COVERAGE_UNKNOWN');
 const window={start:metric.window?.start??metric.start??scope.start,end:metric.window?.end??metric.end??scope.end,timezone:metric.window?.timezone??scope.timezone,date_basis:metric.window?.dateBasis??scope.dateBasis,horizon:metric.horizonDays?{as_of:metric.start,quantity:metric.horizonDays,unit:'day',version:'approved-scenario-v1'}:null};
 return validateMoney({metric_id:metricId,tenant_id:tenantId,currency:metric.currency,exponent:metric.exponent,catalog_version:catalog.version,window,basis:metric.basis??scope.basis,grain,amount_minor:complete?amount:null,known_subtotal:subtotal,coverage:{known_n:known,eligible_n:eligible},status:state,missing_reasons:complete?[]:reasons,provenance:[...provenance,...(metric.evidenceRefs??(metric.evidenceRef?[metric.evidenceRef]:[])).map(reference=>({source:'economic_evidence',reference,version:'immutable'}))],additive},catalog);
}
export function formatMetricEnvelope(envelope,{catalog,locale='es-MX'}){
 if(envelope.money)return formatMoney(envelope.money,{catalog,locale});
 const raw=envelope.native;const subtotal=raw.knownSubtotalMinor===null?'No disponible':formatMinorUnits(raw.knownSubtotalMinor,raw.currency,raw.exponent,locale);
 return 'Catálogo pendiente de revisión · Importe original: '+formatMinorUnits(raw.amountMinor,raw.currency,raw.exponent,locale)+' · Subtotal conocido: '+subtotal;
}
