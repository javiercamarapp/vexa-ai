import {hashValue,EvaluationError} from './evaluate.mjs';
const check=(ok,code)=>{if(!ok)throw new EvaluationError(code);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=(x,allowed)=>object(x)&&Object.keys(x).every(k=>allowed.includes(k));
const reference=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/@#-]{0,255}$/.test(x);
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function instant(value){
 check(typeof value==='string','PILOT_TIME_INVALID');
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
 check(m,'PILOT_TIME_INVALID');const [year,month,day,hour,minute,second]=m.slice(1,7).map(Number);
 const leap=year%4===0&&(year%100!==0||year%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
 check(year>=1&&month>=1&&month<=12&&day>=1&&day<=days[month-1]&&hour<24&&minute<60&&second<60&&(!m[10]||Number(m[10])<=23&&Number(m[11])<60),'PILOT_TIME_INVALID');
 const time=Date.parse(value);check(Number.isFinite(time),'PILOT_TIME_INVALID');return time;
}
const array=x=>Array.isArray(x)&&x.length<=100000;
function population(value){check(array(value)&&value.every(reference)&&new Set(value).size===value.length,'PILOT_POPULATION_INVALID');return new Set(value);}
const unit=(currency,exponent)=>typeof currency==='string'&&/^[A-Z]{3}$/.test(currency)&&Number.isInteger(exponent)&&exponent>=0&&exponent<=6;
function metric(eligible,respondents,numerator){return{status:'reported_from_supplied_human_study',eligible,respondents,missing:eligible-respondents,numerator,denominator:eligible,value:eligible?numerator/eligible:null};}
export function evaluatePilot({study,evaluation}={}){
 check(keys(study,['schema_version','study_id','kind','window_start','window_end','reviewed_at','reviewer_id','evidence_ref','evaluation_binding','eligible_ceo_ids','eligible_buyer_ids','consents','ceo_sessions','buyer_responses'])&&study.schema_version==='vexa-pilot-study-v1'&&reference(study.study_id)&&['synthetic','human'].includes(study.kind)&&reference(study.reviewer_id)&&reference(study.evidence_ref),'PILOT_STUDY_INVALID');
 const start=instant(study.window_start),end=instant(study.window_end),reviewed=instant(study.reviewed_at);check(start<end&&reviewed>=end,'PILOT_WINDOW_INVALID');
 check(object(evaluation)&&evaluation.schema_version==='vexa-evaluation-result-v1'&&['measured','not_measured'].includes(evaluation.status)&&typeof evaluation.dataset_id==='string'&&evaluation.dataset_id.length>0&&object(evaluation.input_hashes)&&['protocol','holdout','dataset','predictions'].every(k=>digest(evaluation.input_hashes[k]))&&object(evaluation.candidate)&&object(evaluation.gold)&&object(evaluation.classification)&&evaluation.release_decision==='not_issued','PILOT_EVALUATION_INVALID');
 const b=study.evaluation_binding;check(keys(b,['dataset_id','protocol_hash','holdout_hash','candidate_hash'])&&b.dataset_id===evaluation.dataset_id&&b.protocol_hash===evaluation.input_hashes.protocol&&b.holdout_hash===evaluation.input_hashes.holdout&&b.candidate_hash===hashValue(evaluation.candidate),'PILOT_EVALUATION_BINDING_MISMATCH');
 const candidateFrozen=instant(evaluation.candidate.frozen_at);
 const ceos=population(study.eligible_ceo_ids),buyers=population(study.eligible_buyer_ids),eligible=new Set([...ceos,...buyers]);check(array(study.consents)&&array(study.ceo_sessions)&&array(study.buyer_responses),'PILOT_OBSERVATIONS_INVALID');
 const consents=new Map();for(const c of study.consents){check(keys(c,['participant_id','consented_at','evidence_ref'])&&eligible.has(c.participant_id)&&!consents.has(c.participant_id)&&reference(c.evidence_ref),'PILOT_CONSENT_INVALID');const at=instant(c.consented_at);check(at<=reviewed,'PILOT_CONSENT_INVALID');consents.set(c.participant_id,at);}
 const consent=(id,at)=>check(consents.has(id)&&consents.get(id)<=at,'PILOT_CONSENT_REQUIRED');
 const seenCeo=new Set();let under=0;
 for(const s of study.ceo_sessions){check(keys(s,['participant_id','started_at','completed_at','comprehension_confirmed','evidence_ref'])&&ceos.has(s.participant_id)&&!seenCeo.has(s.participant_id)&&typeof s.comprehension_confirmed==='boolean'&&reference(s.evidence_ref),'PILOT_CEO_SESSION_INVALID');seenCeo.add(s.participant_id);const from=instant(s.started_at),to=instant(s.completed_at);check(from>=start&&from>=candidateFrozen&&to<=end&&to>=from,'PILOT_SESSION_WINDOW_INVALID');consent(s.participant_id,from);const ms=to-from;if(s.comprehension_confirmed&&ms<300000)under++;}
 const seenBuyer=new Set(),groups=new Map();let insights=0,actions=0,willing=0,unassigned=0;
 for(const r of study.buyer_responses){check(keys(r,['participant_id','responded_at','new_insight','sponsored_action','willingness_to_pay','evidence_ref'])&&buyers.has(r.participant_id)&&!seenBuyer.has(r.participant_id)&&typeof r.new_insight==='boolean'&&reference(r.evidence_ref),'PILOT_BUYER_RESPONSE_INVALID');seenBuyer.add(r.participant_id);const at=instant(r.responded_at);check(at>=start&&at>=candidateFrozen&&at<=end,'PILOT_RESPONSE_WINDOW_INVALID');consent(r.participant_id,at);
  const a=r.sponsored_action;check(keys(a,['committed','sponsor_ref'])&&typeof a.committed==='boolean'&&(a.committed?reference(a.sponsor_ref):a.sponsor_ref===null),'PILOT_SPONSOR_INVALID');
  const w=r.willingness_to_pay;check(keys(w,['willing','amount_minor','currency','exponent'])&&typeof w.willing==='boolean','PILOT_WTP_INVALID');
  if(!w.willing)check(w.amount_minor===null&&w.currency===null&&w.exponent===null,'PILOT_WTP_INCONSISTENT');
  else{check((w.amount_minor===null&&(w.currency===null&&w.exponent===null||unit(w.currency,w.exponent)))||(typeof w.amount_minor==='string'&&/^(0|[1-9][0-9]{0,999})$/.test(w.amount_minor)&&unit(w.currency,w.exponent)),'PILOT_WTP_INVALID');willing++;if(w.currency===null)unassigned++;else{const key=w.currency+':'+w.exponent,g=groups.get(key)??{currency:w.currency,exponent:w.exponent,known_count:0,unknown_count:0,sum:0n};if(w.amount_minor===null)g.unknown_count++;else{g.known_count++;g.sum+=BigInt(w.amount_minor);}groups.set(key,g);}}
  if(r.new_insight)insights++;if(a.committed)actions++;
 }
 const metrics={ceo_comprehension:{...metric(ceos.size,seenCeo.size,under),completed_under_five_minutes:under},new_insight:metric(buyers.size,seenBuyer.size,insights),sponsored_action:metric(buyers.size,seenBuyer.size,actions),willingness_to_pay:{...metric(buyers.size,seenBuyer.size,willing),amount_groups:[...groups.values()].sort((a,b)=>a.currency.localeCompare(b.currency)||a.exponent-b.exponent).map(g=>({currency:g.currency,exponent:g.exponent,known_count:g.known_count,unknown_count:g.unknown_count,known_subtotal_minor:String(g.sum),total_minor:g.unknown_count?null:String(g.sum)})),unassigned_unknown_count:unassigned,combined_total_minor:null}};
 const humanGold=evaluation.status==='measured'&&evaluation.gold.kind==='human_gold'&&evaluation.gold.attestation_supplied===true&&evaluation.gold.double_annotation_complete===true&&evaluation.classification.status==='measured_from_supplied_human_gold';
 const reasons=[];if(!humanGold)reasons.push('SUPPLIED_HUMAN_GOLD_REQUIRED');if(!ceos.size||!seenCeo.size)reasons.push('CEO_OBSERVATIONS_REQUIRED');if(!buyers.size||!seenBuyer.size)reasons.push('BUYER_OBSERVATIONS_REQUIRED');
 const synthetic=study.kind==='synthetic',diagnostics=synthetic?{status:'synthetic_software_diagnostics_only',metrics:structuredClone(metrics)}:null;
 if(synthetic)for(const m of Object.values(diagnostics.metrics))m.status='synthetic_software_diagnostic';
 if(synthetic)for(const m of Object.values(metrics)){m.status='not_measured';m.numerator=null;m.value=null;if('completed_under_five_minutes'in m)m.completed_under_five_minutes=null;if('amount_groups'in m)m.amount_groups=m.amount_groups.map(g=>({...g,known_subtotal_minor:null,total_minor:null}));}
 return{schema_version:'vexa-pilot-result-v1',status:synthetic?'not_measured':reasons.length?'blocked':'requires_human_review',study_kind:study.kind,input_hashes:{study:hashValue(study),evaluation:hashValue(evaluation),binding:hashValue(b)},metrics,synthetic_diagnostics:diagnostics,blocking_reasons:reasons,production_validated:false,formal_acceptance:false,release_decision:'not_issued',causal_savings:{status:'not_established',amount_minor:null},provenance_authenticity:'requires_external_human_audit',notice:'Declared observations and consent metadata require independent human verification. Amounts express stated willingness, not contracted revenue; no causal savings or release approval is established.'};
}
