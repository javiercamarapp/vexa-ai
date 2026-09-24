import {seedCandidates,checkCandidates} from './candidates352.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const tables=['learning_cohorts','learning_items','learning_feedback','candidate_results','candidate_selections','team_invitations','team_audit'];
async function hashes(pool){const out={};for(const t of tables)out[t]=hash((await pool.query(`SELECT to_jsonb(t) v FROM ${t} t ORDER BY to_jsonb(t)::text`)).rows);return out;}
async function team(pool,user,tenant,input){const c=await pool.connect();try{await c.query('BEGIN');await c.query('SET LOCAL ROLE authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);const r=await c.query('select public.team_manage($1,$2) v',[tenant,input]);await c.query('COMMIT');return r.rows[0].v;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
export async function seedCurrent({pool,db,id,A,B,U,V,CA,C,RR}){
 const q=(...x)=>pool.query(...x),cohort=id(101),result=id(102),invitee=id(103),expiredUser=id(104),ownerB=id(105),cfg='e'.repeat(64);
 await q("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,'syn352-invite@example.invalid',now()),($2,'syn352-expired@example.invalid',now()),($3,'syn352-owner-b@example.invalid',now())",[invitee,expiredUser,ownerB]);
 await q("INSERT INTO memberships(tenant_id,user_id,role,status) VALUES($1,$2,'owner','active')",[B,ownerB]);
 await q("UPDATE extraction_runs SET input_hash=$2, provenance=provenance||jsonb_build_object('taxonomy',jsonb_build_array('syn-topic'),'input_manifest',jsonb_build_array(jsonb_build_object('message_revision_id',$3::text)),'usage',jsonb_build_object('costMinor',null)),updated_at=clock_timestamp()-interval '1 minute' WHERE id=$1",[id(22),cfg,RR]);
 await db(pool).transaction('configure',async s=>{
 await s.query("INSERT INTO learning_cohorts(id,tenant_id,actor_id,connection_id,window_start,cutoff,taxonomy_hash,taxonomy,item_count) VALUES($1,$2,$3,$4,clock_timestamp()-interval '1 hour',clock_timestamp(),learning_hash('[\"syn-topic\"]'), '[\"syn-topic\"]',1)",[cohort,A,U,CA]);
 await s.query("INSERT INTO learning_items(tenant_id,cohort_id,ordinal,run_id,conversation_id,input_hash,result_hash,manifest_hash) SELECT tenant_id,$2,1,id,conversation_id,input_hash,learning_hash(provenance->'result'),learning_hash(provenance->'input_manifest') FROM extraction_runs WHERE id=$1",[id(22),cohort]);
 await s.query("INSERT INTO learning_feedback(tenant_id,cohort_id,ordinal,version,actor_id,verdict,labels,topic_correct,evidence_sufficient,decision_possible) VALUES($1,$2,1,1,$3,'abstain','[]',false,false,false)",[A,cohort,U]);
 // Schema round-trip fixture, explicitly not an evaluated/signed eligible candidate.
 const envelope={payload:{tenantId:A,candidateId:'SYN352-NOT-EVALUATED',configHash:cfg,status:'not_measured',totalCostMinor:null},signature:null};
 await s.query('INSERT INTO candidate_results(tenant_id,id,actor_id,candidate_id,config_hash,envelope) VALUES($1,$2,$3,$4,$5,$6)',[A,result,U,envelope.payload.candidateId,cfg,envelope]);
 });
 const accepted=await team(pool,U,A,{operation:'invite',email:'syn352-invite@example.invalid',role:'viewer',requestId:id(106),confirmed:true});
 await team(pool,invitee,A,{operation:'accept',id:accepted.id});
 const ver=(await q('select permissions_version from memberships where tenant_id=$1 and user_id=$2',[A,invitee])).rows[0].permissions_version;
 await team(pool,U,A,{operation:'revoke',id:invitee,version:ver});
 const expired=await team(pool,U,A,{operation:'invite',email:'syn352-expired@example.invalid',role:'viewer',requestId:id(107),confirmed:true});
 // Synthetic clock fixture; no production time or guard changes. It expires before backup.
 await q("update team_invitations set created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour' where id=$1",[expired.id]);
 const candidates=await seedCandidates(db(pool),A,id(108));
 return {candidates,hashes:await hashes(pool),cohort,result,invitee,expiredUser,ownerB,accepted:accepted.id,expired:expired.id,cfg};
}
export async function checkCurrent({pool,db,id,A,B,U,V,state}){
 assert.deepEqual(await hashes(pool),state.hashes,'SQL36_38_ROWS_IDENTICAL_AFTER_RESTORE');
 for(const t of ['learning_cohorts','learning_items','learning_feedback','candidate_results']){
 assert.equal((await db(pool).transaction('read',s=>s.query(`select count(*) n from ${t}`))).rows[0].n,t==='candidate_results'?'2':'1');
 assert.equal((await db(pool,A,V).transaction('read',s=>s.query(`select count(*) n from ${t}`))).rows[0].n,'0');
 assert.equal((await db(pool,B,state.ownerB).transaction('read',s=>s.query(`select count(*) n from ${t}`))).rows[0].n,'0');
 }
 await assert.rejects(()=>team(pool,state.invitee,A,{operation:'accept',id:state.accepted}),e=>e.code==='42501');
 await assert.rejects(()=>team(pool,state.expiredUser,A,{operation:'accept',id:state.expired}),e=>e.code==='42501');
 await assert.rejects(()=>team(pool,V,A,{operation:'list'}),e=>e.code==='42501');
 await assert.rejects(()=>team(pool,state.ownerB,A,{operation:'list'}),e=>e.code==='42501');
 assert.equal((await pool.query('select status from memberships where tenant_id=$1 and user_id=$2',[A,state.invitee])).rows[0].status,'revoked');
 await assert.rejects(()=>db(pool).transaction('configure',s=>s.query("INSERT INTO learning_feedback(tenant_id,cohort_id,ordinal,version,actor_id,verdict,labels,topic_correct,evidence_sufficient,decision_possible) VALUES($1,$2,1,2,$3,'abstain','[]',false,false,false)",[A,state.cohort,U])),e=>e.code==='23514');
 const row=(await pool.query('select envelope from candidate_results where id=$1',[state.result])).rows[0].envelope;
 assert.ok(Object.hasOwn(row.payload,'totalCostMinor'));assert.equal(row.payload.totalCostMinor,null);
 assert.equal((await pool.query('select provenance from extraction_runs where id=$1',[id(22)])).rows[0].provenance.usage.costMinor,null);
 const {createLearningRepository}=await import('../../intelligence/learning/index.mjs');
 const learning=createLearningRepository({database:db(pool)});
 const exported=await learning.exportDevelopment(state.cohort);
 assert.equal(exported.counts.exported,0);
 const candidates=await checkCandidates(db(pool),state.candidates);
 return {candidates,tablesIdentical:state.hashes,ownerVisible:true,viewerAndForeignOwnerDenied:true,revokedInviteReplayDenied:true,expiredInviteDenied:true,erasedFeedbackRejected:true,unknownCostPreserved:true,exportedCount:0,scope:'Real PostgreSQL scoped SQL/RPC + repository export; no Auth HTTP or authentic gold; candidate fixture not eligible and no candidate selection manufactured'};
}
