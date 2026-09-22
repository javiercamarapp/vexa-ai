import {WorkspaceError} from '../workspace-service/contracts.mjs';
export const GENERATOR_VERSION='conditioned-rules-v1';
const ensure=(ok,message)=>{if(!ok)throw new WorkspaceError(message,400);};
// Adapted from laboratory recommend(): deterministic proposals, never financial estimates
// or automatic execution. The repository supplies authorized, captured evidence only.
export function proposeRecommendation({problem,evidenceRefs,causality=null}){
 ensure(problem&&typeof problem.title==='string'&&problem.title.trim()&&Number.isInteger(problem.version),'problem_required');
 ensure(Array.isArray(evidenceRefs)&&evidenceRefs.length>0&&evidenceRefs.every(e=>typeof e.runId==='string'&&typeof e.quote==='string'&&e.quote.trim()&&typeof e.category==='string'),'evidence_required');
 const categories=[...new Set(evidenceRefs.map(e=>e.category))].sort();const critical=causality?.claim?.criticalReview===true||evidenceRefs.some(e=>e.severity==='critical'||/smoke|fire|injur|safety|burn/i.test(e.category));
 const priorities=evidenceRefs.some(e=>e.severity==='high');const state=causality?.claim?.state??'unassessed';const confirmed=state==='confirmed'&&causality.claim.evidenceIds.length>0;
 const subject=problem.title.slice(0,350),category=categories.join(', ').slice(0,250);let action;
 if(critical)action=`Solicitar revisión humana urgente de «${subject}»: contrastar los indicios de ${category} con una inspección operacional independiente antes de cualquier medida externa.`;
 else if(categories.some(c=>/deliver|shipping|carrier|logistic|env[ií]o|entrega/i.test(c)))action=`Contrastar los hitos de transporte y entrega de «${subject}» con registros del transportista para las conversaciones citadas; documentar en qué etapa aparece la incidencia de ${category}.`;
 else if(categories.some(c=>/refund|payment|billing|charge|pago|cobro/i.test(c)))action=`Conciliar «${subject}» con el registro de pagos y reversos autorizado, distinguiendo la solicitud narrada del desembolso registrado antes de proponer una corrección.`;
 else if(categories.some(c=>/quality|defect|product|calidad/i.test(c)))action=`Revisar «${subject}» mediante inspección de producto y evidencia de lote o SKU conocida, contrastando los indicios de ${category} sin atribuir una causa no confirmada.`;
 else action=`Investigar «${subject}» contrastando las citas de ${category} con registros operacionales independientes; documentar una hipótesis verificable y las observaciones que podrían refutarla.`;
 const preconditions=['Asignar una persona responsable autorizada antes de iniciar la investigación.','Mantener el snapshot y alcance indicados como baseline financiero, sin tratar exposición como pérdida.','Aprobar un plan de medición y validar evidencia operacional antes de ejecutar cambios.'];
 if(!confirmed)preconditions.push('La causa sigue sin confirmación operacional; no ejecutar una solución como si estuviera demostrada.');
 if(critical)preconditions.push('Revisión humana prioritaria de seguridad; esta propuesta no autoriza recalls, reembolsos ni acciones CRM.');
 const cause=confirmed?`La evaluación operacional versión ${causality.claim.version} confirma: ${causality.claim.probableCause}. Revisar también la evidencia contraria conservada.`:`Estado causal ${state}: los síntomas citados no acreditan por sí solos una causa.`;
 return {action,preconditions,rationale:`Propuesta condicionada para el problema versión ${problem.version}, respaldada por ${evidenceRefs.length} citas autorizadas en ${categories.length} categorías (${category}). ${cause} No estima ahorros ni atribuye efectos causales.`,priority:critical?'critical':priorities?'high':'normal',effort:'diagnostic_review',generatorVersion:GENERATOR_VERSION,causalState:state,causalVersion:causality?.claim?.version??null,automaticExternalAction:false,causalClaim:false};
}
