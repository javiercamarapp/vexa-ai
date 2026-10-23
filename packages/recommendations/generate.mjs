import {WorkspaceError} from '../workspace-service/contracts.mjs';
import {esSenalCritica} from '../workspace-service/critico.mjs';
// v2 (oct 2026): texto en español, UNA acción concreta y su porqué, categorías más frecuentes con su conteo. Las recomendaciones guardadas con v1 no se tocan.
export const GENERATOR_VERSION='conditioned-rules-v2';
const ensure=(ok,message)=>{if(!ok)throw new WorkspaceError(message,400);};
const ESTADO_CAUSAL={unassessed:'sin evaluar',hypothesis:'causa probable, no confirmada',confirmed:'causa confirmada',retracted:'causa retractada'};
const MAS_FRECUENTES=3;
// Categorías de las citas ordenadas por frecuencia (desc) y luego alfabético por su etiqueta en español: orden estable, no depende del orden de las citas.
export function categoriasFrecuentes(evidenceRefs,etiqueta=x=>x){
 const n=new Map();for(const e of evidenceRefs){const l=etiqueta(e.category);n.set(l,(n.get(l)??0)+1);}
 return [...n].map(([label,count])=>({label,count,raw:[...new Set(evidenceRefs.filter(e=>etiqueta(e.category)===label).map(e=>e.category))]})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'es'));
}
const citas=n=>`${n} ${n===1?'cita':'citas'}`;
// Adapted from laboratory recommend(): deterministic proposals, never financial estimates
// or automatic execution. The repository supplies authorized, captured evidence only.
// `etiqueta`: traduce una categoría de la IA a su etiqueta en español (el repositorio pasa la de apps/web/src/lib/legibilidad); por defecto, la categoría tal cual.
export function proposeRecommendation({problem,evidenceRefs,causality=null,etiqueta=x=>x}){
 ensure(problem&&typeof problem.title==='string'&&problem.title.trim()&&Number.isInteger(problem.version),'problem_required');
 ensure(Array.isArray(evidenceRefs)&&evidenceRefs.length>0&&evidenceRefs.every(e=>typeof e.runId==='string'&&typeof e.quote==='string'&&e.quote.trim()&&typeof e.category==='string'),'evidence_required');
 const ranked=categoriasFrecuentes(evidenceRefs,etiqueta),top=ranked.slice(0,MAS_FRECUENTES),rest=ranked.length-top.length;
 const lista=top.map(c=>`«${c.label}» (${citas(c.count)})`),topTxt=rest>0?lista.join(', ')+` y ${rest} ${rest===1?'categoría':'categorías'} más`:lista.length>1?lista.slice(0,-1).join(', ')+' y '+lista.at(-1):lista[0];
 // La rama de la acción mira las categorías que pesan (≥25 % de las citas), no una cita suelta.
 const dominant=ranked.filter(c=>c.count>=Math.max(1,evidenceRefs.length*0.25)).flatMap(c=>c.raw);
 const critical=causality?.claim?.criticalReview===true||evidenceRefs.some(e=>e.severity==='critical'||/smoke|fire|injur|safety|burn/i.test(e.category));
 const signals=evidenceRefs.filter(esSenalCritica).length;
 const priorities=signals>0;const state=causality?.claim?.state??'unassessed';const confirmed=state==='confirmed'&&causality.claim.evidenceIds.length>0;
 const subject=etiqueta(problem.title).slice(0,350);let action;
 if(critical)action=`Solicitar revisión humana urgente de «${subject}»: contrastar los indicios citados con una inspección operativa independiente antes de cualquier medida externa.`;
 else if(dominant.some(c=>/deliver|shipping|carrier|logistic|env[ií]o|entrega/i.test(c)))action=`Contrastar los hitos de transporte y entrega de «${subject}» con los registros del transportista para las conversaciones citadas; documentar en qué etapa aparece la incidencia.`;
 else if(dominant.some(c=>/refund|payment|billing|charge|pago|cobro/i.test(c)))action=`Conciliar «${subject}» con el registro de pagos y reversos autorizado, distinguiendo la solicitud narrada del desembolso registrado antes de proponer una corrección.`;
 else if(dominant.some(c=>/quality|defect|damaged|battery|calidad|defecto|batería/i.test(c)))action=`Revisar «${subject}» mediante inspección de producto y evidencia de lote o SKU conocida, contrastando los indicios citados sin atribuir una causa no confirmada.`;
 else action=`Investigar «${subject}» contrastando las citas con registros operativos independientes; documentar una hipótesis verificable y las observaciones que podrían refutarla.`;
 const preconditions=['Asignar una persona responsable autorizada antes de iniciar la investigación.','Mantener el snapshot y alcance indicados como baseline financiero, sin tratar exposición como pérdida.','Aprobar un plan de medición y validar evidencia operacional antes de ejecutar cambios.'];
 if(!confirmed)preconditions.push('La causa sigue sin confirmación operacional; no ejecutar una solución como si estuviera demostrada.');
 if(critical)preconditions.push('Revisión humana prioritaria de seguridad; esta propuesta no autoriza recalls, reembolsos ni acciones CRM.');
 const cause=confirmed?`La evaluación operacional versión ${causality.claim.version} confirma: ${causality.claim.probableCause}. Revisar también la evidencia contraria conservada.`:`Estado causal: ${ESTADO_CAUSAL[state]??state}. Los síntomas citados no acreditan por sí solos una causa.`;
 const senal=signals>0?` ${signals===1?'1 de ellas es una señal crítica':signals+' de ellas son señales críticas'} (severidad alta o crítica, o categoría de seguridad, privacidad, fraude o fuego).`:'';
 const n=evidenceRefs.length,k=ranked.length;
 return {action,preconditions,rationale:`Por qué: ${n} ${n===1?'cita autorizada':'citas autorizadas'} en ${k} ${k===1?'categoría':'categorías'}; las más frecuentes son ${topTxt}.${senal} Propuesta condicionada para el problema versión ${problem.version}. ${cause} No estima ahorros ni atribuye efectos causales.`,priority:critical?'critical':priorities?'high':'normal',effort:'diagnostic_review',generatorVersion:GENERATOR_VERSION,causalState:state,causalVersion:causality?.claim?.version??null,automaticExternalAction:false,causalClaim:false};
}
