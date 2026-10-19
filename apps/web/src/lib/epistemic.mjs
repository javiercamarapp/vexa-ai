// Epistemic class of a published figure: how the number is known. Presentation rule, never changes the amount.
//  observed  = recorded fact in a source ledger (orders, settled refunds)
//  estimated = produced by a model / scenario / forecast
//  inferred  = obtained by linking records through evidence (e.g. revenue exposed to a problem): not a loss, not additive
export const KINDS=Object.freeze({
 observed:{label:'Observado',hint:'Registrado en la fuente (pedidos, reembolsos liquidados).'},
 estimated:{label:'Estimado',hint:'Calculado con un modelo o escenario; no es un hecho registrado.'},
 inferred:{label:'Inferido',hint:'Vinculado por evidencia (p. ej. ingresos expuestos a un problema); no equivale a pérdida.'},
 unclassified:{label:'Sin clasificar',hint:'Este tipo de cifra aún no tiene clase asignada; no se presenta como observada.'}});
export function epistemicKind(metric){
 const kind=String(metric?.kind??'').toLowerCase(),status=String(metric?.status??'').toLowerCase();
 if(/scenario|model|forecast|support_model/.test(kind)||status==='modeled')return 'estimated';
 if(kind==='exposure'||kind.startsWith('exposure'))return 'inferred';
 if(/^(allorders|orders?|refunds?|reversals?|replacement)$/.test(kind))return 'observed';
 return 'unclassified';
}
