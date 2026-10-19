import {createEvidenceRepository} from '../intelligence/evidence-repository.mjs';
import {memoized,inMemoSection} from './ledger-load.mjs';
import {requireThat} from '../problems/contracts.mjs';
// Las cinco lecturas de createEvidenceRepository.get(): determinísticas dentro de la transacción. Dentro de una sección de memo se ejecutan una sola vez por
// (sentencia, parámetros), aunque varios módulos pidan la evidencia de la misma corrida (autorización del snapshot, prioridades, problemas). Si el texto de una
// sentencia cambiara, simplemente deja de memoizarse. Cada llamada recibe una copia: ningún consumidor puede alterar lo que ve otro.
const HEADS=['SELECT id,status,conversation_id,input_hash,provenance,model_id,created_at FROM public.extraction_runs','SELECT c.id,c.external_id,c.source,c.connection_id,c.deleted_at,n.account_id,n.status,h.state FROM public.conversations c','SELECT r.id,r.message_id,r.redacted_text,r.hash,r.deleted_at,r.redaction_version,r.provenance,','SELECT EXISTS(SELECT 1 FROM jsonb_to_recordset($3::jsonb) AS x(kind text,external_id text) WHERE public.retention_source_deleted','SELECT id FROM public.tombstones WHERE tenant_id=$1 AND (connection_id IS NULL OR connection_id=$2) AND deleted_source_key=ANY($3::text[]) LIMIT 1'];
const wrappers=new WeakMap();
export function evidenceSession(s){
 let w=wrappers.get(s);if(w)return w;
 w=Object.create(s);
 Object.defineProperty(w,'query',{value:(text,values)=>{const norm=typeof text==='string'?text.replace(/\s+/g,' ').trim():null;if(norm&&inMemoSection(s)&&HEADS.some(h=>norm.startsWith(h)))return memoized(s,'evq:'+norm+JSON.stringify(values??[]),()=>s.query(text,values)).then(r=>({...r,rows:structuredClone(r.rows)}));return s.query(text,values);}});
 wrappers.set(s,w);return w;
}
const scoped=s=>({transaction:async(_action,fn)=>fn(evidenceSession(s))});
export const evidenceDatabase=s=>scoped(s);
/**
 * Resultado de createEvidenceRepository.get(runId) para esta transacción: el objeto de evidencia, o null si es EVIDENCE_UNAVAILABLE.
 * Memoizado por corrida dentro de una sección (ledger-load.memoSection): varias comprobaciones de la misma corrida cuestan una sola lectura.
 * Cualquier otro error se propaga igual que antes.
 */
export const evidenceRun=(s,runId)=>memoized(s,'evidence-get:'+runId,async()=>{try{return await createEvidenceRepository({database:scoped(s)}).get(runId);}catch(e){if(e&&e.message==='EVIDENCE_UNAVAILABLE')return null;throw e;}});
/** Equivalente memoizado de problems/repository.evidence(): mismos errores (EVIDENCE_UNAVAILABLE o source_unavailable 409) y mismo objeto de evidencia. */
export const evidenceCurrent=async(s,runId)=>{const e=await evidenceRun(s,runId);if(!e)throw Object.assign(Error('EVIDENCE_UNAVAILABLE'),{code:'23514'});requireThat(e.state==='current'&&e.status==='succeeded','source_unavailable',409);return e;};
