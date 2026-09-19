// PostgreSQL controls of the EXAM ONLY. Never loaded by the candidate gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {launch,read,write,denied} from './harness.mjs';
import {definitions,relations,ident,q,insert,freshRow} from './matrix.mjs';
import {serviceOracle,storageWriteOracle} from './services.mjs';
import {identityOracle,selfReactivateOracle,schemaOracle,seed,seedStep,tableOracle,fkOracle,revokeOracle,ownWriteOracle,foreignKeys,discoveredFkOracle,A,B} from './oracles.mjs';

function reference(h){
  h.sql(`CREATE TABLE organizations(id uuid PRIMARY KEY,name text);
    CREATE TABLE memberships(tenant_id uuid REFERENCES organizations(id),user_id uuid,role text,status text,permissions_version integer DEFAULT 1,PRIMARY KEY(tenant_id,user_id));
    ALTER TABLE organizations ENABLE ROW LEVEL SECURITY; ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON organizations,memberships TO authenticated;
    CREATE POLICY own_org ON organizations FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM memberships m WHERE m.tenant_id=organizations.id AND m.user_id=auth.uid() AND m.status='active'));
    CREATE POLICY own_membership ON memberships FOR SELECT TO authenticated USING(user_id=auth.uid());`);
  for(const [name,values,refs=[]] of definitions){
    const cols=['id uuid PRIMARY KEY','tenant_id uuid NOT NULL REFERENCES organizations(id)','updated_at timestamptz NOT NULL DEFAULT now()',...Object.entries(values).map(([k,v])=>`${ident(k)} ${typeof v==='number'?'integer':typeof v==='object'?'jsonb':'text'}`),...refs.map(([col])=>`${ident(col)} uuid`),'UNIQUE(tenant_id,id)'];
    h.sql(`CREATE TABLE ${ident(name)}(${cols});ALTER TABLE ${ident(name)} ENABLE ROW LEVEL SECURITY;GRANT SELECT ON ${ident(name)} TO authenticated;
      CREATE POLICY tenant_read ON ${ident(name)} FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=auth.uid() AND m.tenant_id=${ident(name)}.tenant_id AND m.status='active'));`);
  }
  for(const {table,column,parent} of relations)h.sql(`ALTER TABLE ${ident(table)} ADD CONSTRAINT ${ident('fk_'+table+'_'+column)} FOREIGN KEY(tenant_id,${ident(column)}) REFERENCES ${ident(parent)}(tenant_id,id);`);
  h.sql(`ALTER TABLE conversations ADD UNIQUE(tenant_id,connection_id,entity_type,external_id,source_revision);
    GRANT INSERT,UPDATE,DELETE ON connections TO authenticated;
    CREATE POLICY owner_write ON connections FOR ALL TO authenticated USING(EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=auth.uid() AND m.tenant_id=connections.tenant_id AND m.status='active' AND m.role='owner')) WITH CHECK(EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=auth.uid() AND m.tenant_id=connections.tenant_id AND m.status='active' AND m.role='owner'));
    CREATE FUNCTION exam_no_move() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.tenant_id<>NEW.tenant_id THEN RAISE EXCEPTION 'immutable tenant' USING ERRCODE='23514';END IF;RETURN NEW;END $$;
    CREATE TRIGGER no_move BEFORE UPDATE ON connections FOR EACH ROW EXECUTE FUNCTION exam_no_move();`);
}

test('SQL exam controls: real PostgreSQL positive matrix and named mutants',{timeout:600000},async t=>{
  const h=await launch();t.after(()=>h.close());reference(h);
  const actors=Object.fromEntries(['a','b','dual','outsider','viewer','analyst','operator'].map(k=>[k,{id:randomUUID()}]));
  const f=seed(h,actors);
  await t.test('constraint errors never count as authorization denial',()=>{for(const code of ['23503','23505','23514','42601','42P01'])assert.throws(()=>denied({code},'NOT_AUTH_DENIAL'),/NOT_AUTH_DENIAL/);});
  await t.test('positive: every table and mandatory relation',()=>{identityOracle(h,actors);schemaOracle(h);for(const [name] of definitions)tableOracle(h,name,f,actors);for(const r of relations)fkOracle(h,f,r);});
  for(const [role,actor,label] of [['anon',null,'MEMBERSHIP_ANON'],['authenticated',actors.outsider,'MEMBERSHIP_OUTSIDER']])await t.test('mutant: memberships '+role+' disclosure',()=>{
    identityOracle(h,actors);
    h.sql(`GRANT SELECT ON memberships TO ${role}; CREATE POLICY mutant_membership ON memberships FOR SELECT TO ${role} USING(true);`);
    try{
      assert.ok(h.probe(read('memberships'),actor).rows.length>=7,'REAL_MEMBERSHIP_LEAK');
      assert.throws(()=>identityOracle(h,actors),new RegExp(label));
    }finally{h.sql('DROP POLICY mutant_membership ON memberships;'+(role==='anon'?'REVOKE SELECT ON memberships FROM anon;':''));}
    identityOracle(h,actors);
  });
  await t.test('positive: domain uniqueness and immutable audit',()=>{
    h.sql(`ALTER TABLE attempts ADD UNIQUE(tenant_id,job_id,attempt_number);
      ALTER TABLE checkpoints ADD UNIQUE(tenant_id,job_id,stage);
      ALTER TABLE problem_versions ADD UNIQUE(tenant_id,problem_id,version);
      CREATE FUNCTION exam_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'immutable audit' USING ERRCODE='23514'; END $$;
      CREATE TRIGGER exam_audit_immutable BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION exam_audit_immutable();`);
    for(const table of ['attempts','checkpoints','problem_versions','audit_events'])tableOracle(h,table,f,actors);
  });
  await t.test('domain guards cannot hide a missing physical foreign key',()=>{
    const relation={table:'measurement_plans',column:'intervention_id',parent:'interventions'};
    const constraint='fk_measurement_plans_intervention_id';
    const fk=foreignKeys(h).find(x=>x.name===constraint);assert.ok(fk);
    h.sql(`CREATE FUNCTION exam_plan_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF TG_OP='UPDATE' AND NEW.intervention_id IS DISTINCT FROM OLD.intervention_id THEN RAISE EXCEPTION 'immutable parent' USING ERRCODE='23514'; END IF;
      IF (SELECT tenant_id FROM interventions WHERE id=NEW.intervention_id) IS DISTINCT FROM NEW.tenant_id THEN RAISE EXCEPTION 'parent unavailable' USING ERRCODE='23503'; END IF;
      RETURN NEW; END $$;
      CREATE TRIGGER exam_plan_guard BEFORE INSERT OR UPDATE ON measurement_plans FOR EACH ROW EXECUTE FUNCTION exam_plan_guard();`);
    const triggerState=()=>h.sql("SELECT string_agg(tgname::text||':'||tgenabled::text,',' ORDER BY tgname) FROM pg_trigger WHERE tgrelid='measurement_plans'::regclass");
    const before=triggerState();
    try{
      fkOracle(h,f,relation);discoveredFkOracle(h,f,fk);
      assert.equal(triggerState(),before,'FK_PROBE_RESTORES_ALL_TRIGGERS');
      h.sql(`ALTER TABLE measurement_plans ALTER CONSTRAINT ${constraint} DEFERRABLE INITIALLY DEFERRED;`);
      fkOracle(h,f,relation);discoveredFkOracle(h,f,fk);
      h.sql(`ALTER TABLE measurement_plans DROP CONSTRAINT ${constraint};`);
      // The synthetic domain guard still rejects B. It must NOT substitute for an FK.
      assert.throws(()=>fkOracle(h,f,relation),/FK_CROSS:measurement_plans/);
      assert.throws(()=>discoveredFkOracle(h,f,fk),/EXTRA_FK_CROSS/);
      assert.throws(()=>schemaOracle(h),/FK_MISSING:measurement_plans/);
    }finally{
      h.sql(`DROP TRIGGER exam_plan_guard ON measurement_plans; DROP FUNCTION exam_plan_guard();
        ALTER TABLE measurement_plans DROP CONSTRAINT IF EXISTS ${constraint};
        ALTER TABLE measurement_plans ADD CONSTRAINT ${constraint} FOREIGN KEY(tenant_id,intervention_id) REFERENCES interventions(tenant_id,id);`);
    }
  });
  await t.test('positive: extra tenant-aware FK, membership owner, currency superset',()=>{
    h.sql(`ALTER TABLE orders ADD COLUMN connection_id uuid;
      ALTER TABLE orders ADD CONSTRAINT extra_connection FOREIGN KEY(tenant_id,connection_id) REFERENCES connections(tenant_id,id);
      ALTER TABLE recommendations ADD COLUMN owner_id uuid;
      ALTER TABLE recommendations ADD CONSTRAINT extra_owner FOREIGN KEY(tenant_id,owner_id) REFERENCES memberships(tenant_id,user_id);
      ALTER TABLE economic_events ADD UNIQUE(tenant_id,id,currency,exponent);
      ALTER TABLE reversals DROP CONSTRAINT fk_reversals_reversal_of;
      ALTER TABLE reversals ADD CONSTRAINT extra_currency FOREIGN KEY(tenant_id,reversal_of,currency,exponent) REFERENCES economic_events(tenant_id,id,currency,exponent);`);
    try{
      schemaOracle(h);
      for(const fk of foreignKeys(h))discoveredFkOracle(h,f,fk);
      // Also exercise the discovered graph in an independently seeded A/B database below.
    }finally{
      h.sql(`ALTER TABLE orders DROP COLUMN connection_id; ALTER TABLE recommendations DROP COLUMN owner_id;
        ALTER TABLE reversals DROP CONSTRAINT extra_currency;
        ALTER TABLE reversals ADD CONSTRAINT fk_reversals_reversal_of FOREIGN KEY(tenant_id,reversal_of) REFERENCES economic_events(tenant_id,id);`);
    }
    schemaOracle(h);
  });
  await t.test('mutant: audit_events USING(true) leaks B',()=>{
    h.sql('CREATE POLICY mutant ON audit_events FOR SELECT TO authenticated USING(true);');
    try{assert.throws(()=>tableOracle(h,'audit_events',f,actors),/READ_A:audit_events/);}finally{h.sql('DROP POLICY mutant ON audit_events;');}
  });
  await t.test('mutant: jobs WITH CHECK(true) permits foreign INSERT without RETURNING',()=>{
    h.sql('GRANT INSERT ON jobs TO authenticated; CREATE POLICY mutant ON jobs FOR INSERT TO authenticated WITH CHECK(true);');
    try{assert.throws(()=>denied(h.probe(write(insert('jobs',{...f.b.jobs,id:randomUUID(),input_hash:'mutant'})),actors.a),'INSERT_B:jobs'),/INSERT_B:jobs/);}finally{h.sql('DROP POLICY mutant ON jobs;REVOKE INSERT ON jobs FROM authenticated;');}
  });
  for(const r of relations)await t.test('mutant: removed FK '+r.table+'.'+r.column,()=>{
    const name=r.table,constraint='fk_'+r.table+'_'+r.column;
    h.sql(`ALTER TABLE ${ident(r.table)} DROP CONSTRAINT ${ident(constraint)};`);
    try{assert.throws(()=>schemaOracle(h),new RegExp('FK_MISSING:'+name));assert.throws(()=>fkOracle(h,f,r),new RegExp('FK_CROSS:'+name));}
    finally{h.sql(`ALTER TABLE ${ident(r.table)} ADD CONSTRAINT ${ident(constraint)} FOREIGN KEY(tenant_id,${ident(r.column)}) REFERENCES ${ident(r.parent)}(tenant_id,id);`);}
    schemaOracle(h);fkOracle(h,f,r);
  });
  for(const table of ['connections','jobs'])for(const role of table==='connections'?['viewer','analyst','operator']:['a','viewer','analyst','operator'])
    for(const operation of ['INSERT','UPDATE','DELETE'])await t.test(`mutant: ${role} ${operation} own ${table}`,()=>{
      const leaf={...f.a[table],id:randomUUID(),...(table==='connections'?{account_id:randomUUID()}:{input_hash:randomUUID()})};
      h.sql(insert(table,leaf)+';');
      const fresh={...leaf,id:randomUUID(),...(table==='connections'?{account_id:randomUUID()}:{input_hash:randomUUID()})};
      try {
        ownWriteOracle(h,table,operation,actors[role],role,fresh,leaf.id);
        h.sql(`GRANT ${operation} ON ${ident(table)} TO authenticated;
          CREATE POLICY mutant ON ${ident(table)} FOR ${operation} TO authenticated
          ${operation==='INSERT'?'WITH CHECK':'USING'}(EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=auth.uid() AND m.tenant_id=${ident(table)}.tenant_id AND m.status='active'));`);
        try{assert.throws(()=>ownWriteOracle(h,table,operation,actors[role],role,fresh,leaf.id),new RegExp(`${operation}_OWN_DENIED:${table}:${role}`));}
        finally{h.sql(`DROP POLICY mutant ON ${ident(table)};`+(table==='jobs'?`REVOKE ${operation} ON jobs FROM authenticated;`:''));}
        ownWriteOracle(h,table,operation,actors[role],role,fresh,leaf.id);
      }finally{h.sql(`DELETE FROM ${ident(table)} WHERE id=${q(leaf.id)};`);}
    });
  for(const column of ['customer_id','order_id'])await t.test('mutant: conversations scalar FK '+column,()=>{
    const r=relations.find(x=>x.table==='conversations'&&x.column===column),constraint='fk_conversations_'+column;
    fkOracle(h,f,r);
    h.sql(`ALTER TABLE conversations DROP CONSTRAINT ${ident(constraint)}; ALTER TABLE conversations ADD CONSTRAINT ${ident(constraint)} FOREIGN KEY(${ident(column)}) REFERENCES ${ident(r.parent)}(id);`);
    try{assert.throws(()=>schemaOracle(h),new RegExp('FK_MISSING:conversations.'+column));assert.throws(()=>fkOracle(h,f,r),new RegExp('FK_CROSS:conversations.'+column));}
    finally{h.sql(`ALTER TABLE conversations DROP CONSTRAINT ${ident(constraint)}; ALTER TABLE conversations ADD CONSTRAINT ${ident(constraint)} FOREIGN KEY(tenant_id,${ident(column)}) REFERENCES ${ident(r.parent)}(tenant_id,id);`);}
    fkOracle(h,f,r);
  });
  await t.test('mutant: additional unclassified private FK',()=>{
    schemaOracle(h);
    h.sql('ALTER TABLE conversations ADD COLUMN legacy_order_id uuid REFERENCES orders(id);');
    try{
      assert.equal(h.probe(write(`UPDATE conversations SET legacy_order_id=${q(f.b.orders.id)} WHERE id=${q(f.a.conversations.id)}`)).rows[0].affected,1,'REAL_EXTRA_FK_ATTACK');
      assert.throws(()=>schemaOracle(h),/FK_UNCLASSIFIED:conversations->orders/);
    }finally{h.sql('ALTER TABLE conversations DROP COLUMN legacy_order_id;');}
    schemaOracle(h);
  });
  await t.test('mutant: same-tenant duplicates admitted',()=>{
    const unique=h.sql("SELECT conname FROM pg_constraint WHERE conrelid='conversations'::regclass AND contype='u' AND cardinality(conkey)=5");
    h.sql(`ALTER TABLE conversations DROP CONSTRAINT ${ident(unique)};`);
    try{assert.throws(()=>assert.equal(h.probe(write(insert('conversations',{...f.a.conversations,id:randomUUID()}))).code,'23505','DEDUP_IDENTITY'),/DEDUP_IDENTITY/);}
    finally{h.sql(`ALTER TABLE conversations ADD CONSTRAINT ${ident(unique)} UNIQUE(tenant_id,connection_id,entity_type,external_id,source_revision);`);}
  });
  await t.test('revocation of old SQL identity on every table',()=>revokeOracle(h,f,actors));
  await t.test('mutant: revoked membership exposes other identities',()=>{
    revokeOracle(h,f,actors);
    h.sql(`CREATE POLICY mutant_revoked ON memberships FOR SELECT TO authenticated USING(true);`);
    try{assert.throws(()=>revokeOracle(h,f,actors),/REVOKED_MEMBERSHIP_ISOLATION/);}
    finally{h.sql('DROP POLICY mutant_revoked ON memberships;');}
    revokeOracle(h,f,actors);
  });
});

// SQL policies and functions are reference fixtures ONLY; HTTP is the real local stack.
test('service controls: real Auth, Storage and PostgREST with payload mutants',{timeout:240000},async t=>{
  const h=await launch({services:true});t.after(()=>h.close());reference(h);
  h.sql(`ALTER TABLE orders ADD COLUMN connection_id uuid NOT NULL;
    ALTER TABLE orders ADD CONSTRAINT extra_connection FOREIGN KEY(tenant_id,connection_id) REFERENCES connections(tenant_id,id);
    ALTER TABLE recommendations ADD COLUMN owner_id uuid NOT NULL;
    ALTER TABLE recommendations ADD CONSTRAINT extra_owner FOREIGN KEY(tenant_id,owner_id) REFERENCES memberships(tenant_id,user_id);
    ALTER TABLE economic_events ADD UNIQUE(tenant_id,id,currency,exponent);
    ALTER TABLE reversals DROP CONSTRAINT fk_reversals_reversal_of;
    ALTER TABLE reversals ADD CONSTRAINT extra_currency FOREIGN KEY(tenant_id,reversal_of,currency,exponent) REFERENCES economic_events(tenant_id,id,currency,exponent);`);
  // Independent reference schema, never candidate SQL: nullable self link and
  // bidirectional cycle with a REQUIRED return edge.
  h.sql(`ALTER TABLE problem_versions ADD COLUMN previous_version_id uuid;
    ALTER TABLE problem_versions ADD CONSTRAINT cycle_previous FOREIGN KEY(tenant_id,previous_version_id) REFERENCES problem_versions(tenant_id,id) MATCH SIMPLE;
    ALTER TABLE interventions ADD COLUMN measurement_ref uuid;
    ALTER TABLE interventions ADD CONSTRAINT cycle_measurement FOREIGN KEY(tenant_id,measurement_ref) REFERENCES measurement_plans(tenant_id,id) MATCH SIMPLE;
    ALTER TABLE measurement_plans ALTER COLUMN intervention_id SET NOT NULL;`);
  // Independent temporal identity constraint; not copied from candidate DDL.
  h.sql(`ALTER TABLE problem_conversations ADD COLUMN valid_from timestamptz NOT NULL DEFAULT '2026-09-01T00:00:00Z';
    ALTER TABLE problem_conversations ADD COLUMN valid_until timestamptz;
    ALTER TABLE problem_conversations ADD CHECK(valid_until IS NULL OR valid_until>valid_from);
    ALTER TABLE problem_conversations ADD UNIQUE(tenant_id,problem_id,conversation_id,valid_from);`);
  const actors={};for(const key of ['a','b','dual','outsider','viewer','analyst','operator'])actors[key]=await h.user();
  const f=seed(h,actors);
  await t.test('positive: catalog-seeded nonnull additional FKs and currency superset',()=>{
    // Reproduce both old fixture failures on this independent reference first.
    const oldDelete=h.probe(write(`DELETE FROM memberships WHERE user_id=${q(actors.a.id)}`));
    assert.equal(oldDelete.code,'23503','LEGACY_MEMBERSHIP_FIXTURE_RED');
    assert.equal(oldDelete.constraint,'extra_owner','LEGACY_MEMBERSHIP_DEPENDENT');
    identityOracle(h,actors);
    assert.equal(h.sql(`SELECT count(*) FROM memberships WHERE user_id=${q(actors.outsider.id)}`),'0','OUTSIDER_CLEANUP');
    const oldClone={...f.a.problem_conversations,id:randomUUID()};
    assert.equal(h.probe(write(insert('problem_conversations',oldClone))).code,'23505','LEGACY_TEMPORAL_FIXTURE_RED');
    for(const source of [f.a.problem_conversations,{...f.a.problem_conversations,valid_until:'2026-09-02T00:00:00Z'}]){
      const clone=freshRow(source);
      assert.ok(Date.parse(clone.valid_from)<Date.parse(clone.valid_until),'CLONE_WINDOW_VALID');
      assert.ok(Date.parse(clone.valid_until)<Date.parse(source.valid_from),'CLONE_WINDOW_DISJOINT');
      assert.equal(h.probe(write(insert('problem_conversations',clone))).code,'00000','TEMPORAL_FIXTURE_GREEN');
    }
    t.diagnostic('Independent fixtures: legacy membership DELETE=23503, legacy temporal clone=23505; corrected identity and bounded/open temporal clones PASS');
    tableOracle(h,'problem_conversations',f,actors);
    for(const relation of relations.filter(r=>r.table==='problem_conversations'))fkOracle(h,f,relation);
    schemaOracle(h);
    for(const fk of foreignKeys(h))discoveredFkOracle(h,f,fk);
    for(const table of ['orders','recommendations','reversals'])tableOracle(h,table,f,actors);
    // Keep all 72 controls; extend this existing catalog-seed control with
    // positives and individually killed missing/scalar FK mutations.
    for(const side of ['a','b']){
      assert.equal(f[side].problem_versions.previous_version_id,null,'SELF_NULLABLE_SEED');
      assert.equal(f[side].interventions.measurement_ref,null,'CYCLE_NULLABLE_SEED');
      assert.equal(f[side].measurement_plans.intervention_id,f[side].interventions.id,'CYCLE_REQUIRED_PRESERVED');
    }
    for(const fk of foreignKeys(h).filter(fk=>['cycle_previous','cycle_measurement','fk_measurement_plans_intervention_id'].includes(fk.name))){
      discoveredFkOracle(h,f,fk);
      const column=Object.keys(fk.mapping).find(col=>col!=='tenant_id');
      const restore=()=>h.sql(`ALTER TABLE ${ident(fk.table)} ADD CONSTRAINT ${ident(fk.name)} FOREIGN KEY(tenant_id,${ident(column)}) REFERENCES ${ident(fk.parent)}(tenant_id,id) MATCH SIMPLE;`);
      h.sql(`ALTER TABLE ${ident(fk.table)} DROP CONSTRAINT ${ident(fk.name)};`);
      try{assert.throws(()=>discoveredFkOracle(h,f,fk),new RegExp('EXTRA_FK_CROSS:'+fk.name));}finally{restore();}
      discoveredFkOracle(h,f,fk);
      h.sql(`ALTER TABLE ${ident(fk.table)} DROP CONSTRAINT ${ident(fk.name)};
        ALTER TABLE ${ident(fk.table)} ADD CONSTRAINT ${ident(fk.name)} FOREIGN KEY(${ident(column)}) REFERENCES ${ident(fk.parent)}(id);`);
      try{assert.throws(()=>discoveredFkOracle(h,f,fk),new RegExp('EXTRA_FK_CROSS:'+fk.name));}finally{h.sql(`ALTER TABLE ${ident(fk.table)} DROP CONSTRAINT ${ident(fk.name)};`);restore();}
      discoveredFkOracle(h,f,fk);
    }
    for(const match of ['s','f']){
      const edge={table:'synthetic',parent:'synthetic',match,nullable:match==='s'?[]:['previous_id']};
      assert.throws(()=>seedStep(['synthetic'],[edge],new Set()),/FIXTURE_UNSUPPORTED_FK_CYCLE/);
    }
    for(const table of ['problem_versions','interventions','measurement_plans'])tableOracle(h,table,f,actors);
    const bad={...f.a.reversals,id:randomUUID(),currency:'MXN'};
    const result=h.probe(write(insert('reversals',bad)));
    assert.equal(result.code,'23503','CURRENCY_FK_MISMATCH');
    assert.equal(result.constraint,'extra_currency','CURRENCY_FK_DIAGNOSTIC');
  });
  h.sql(`INSERT INTO storage.buckets(id,name,public) VALUES('vexa-private','vexa-private',false);
    CREATE POLICY exam_storage_read ON storage.objects FOR SELECT TO authenticated
    USING(bucket_id='vexa-private' AND EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=auth.uid() AND m.status='active' AND m.tenant_id::text=split_part(name,'/',1)));
    CREATE POLICY exam_storage_insert ON storage.objects FOR INSERT TO authenticated
    WITH CHECK(bucket_id='vexa-private' AND EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=auth.uid() AND m.status='active' AND m.role IN ('owner','analyst') AND m.tenant_id::text=split_part(name,'/',1)));
    CREATE POLICY exam_storage_delete ON storage.objects FOR DELETE TO authenticated
    USING(bucket_id='vexa-private' AND EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=auth.uid() AND m.status='active' AND m.role='owner' AND m.tenant_id::text=split_part(name,'/',1)));`);
  const rpc=(mode='safe')=>h.sql(`CREATE OR REPLACE FUNCTION public.match_embeddings(query_embedding jsonb,match_count integer,tenant_id uuid)
    RETURNS TABLE(id uuid,content text,metadata jsonb) LANGUAGE sql SECURITY DEFINER SET search_path=public AS $rpc$
    SELECT e.id,${mode==='content'?"(SELECT b.content FROM embeddings b WHERE b.tenant_id<>e.tenant_id LIMIT 1)":'e.content'},
      ${mode==='metadata'?"jsonb_build_object('nested',jsonb_build_object('text',(SELECT b.content FROM embeddings b WHERE b.tenant_id<>e.tenant_id LIMIT 1)))":"jsonb_build_object('tenant_id',e.tenant_id)"}
    FROM embeddings e WHERE e.tenant_id=$3 AND EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=auth.uid() AND m.tenant_id=e.tenant_id AND m.status='active') LIMIT $2;
    $rpc$; GRANT EXECUTE ON FUNCTION public.match_embeddings(jsonb,integer,uuid) TO authenticated,anon;
    NOTIFY pgrst,'reload schema';`);
  rpc();
  // Synchronize schema reload through a real request; a binding error is never a killed mutant.
  let ready=false;for(let i=0;i<50;i++){
    const r=await h.http('rest','/rpc/match_embeddings',actors.a.token,{method:'POST',body:{query_embedding:[1,0,0],match_count:100,tenant_id:A}});
    if(r.status===200){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(ready,'INFRA_RPC_REFERENCE_RELOAD');
  const check=async()=>{
    const revoked=await serviceOracle(h,f,actors);
    h.sql(`UPDATE memberships SET status='revoked' WHERE user_id=${q(actors.a.id)};`);
    try{await revoked();}finally{h.sql(`UPDATE memberships SET status='active' WHERE user_id=${q(actors.a.id)};`);}
  };
  await t.test('positive Storage, RPC payload and old JWT revocation',async()=>{
    await check();
    h.sql(`UPDATE memberships SET status='revoked' WHERE user_id=${q(actors.a.id)};
      GRANT UPDATE(status) ON memberships TO authenticated;
      CREATE POLICY mutant_reactivate ON memberships FOR UPDATE TO authenticated USING(user_id=auth.uid() AND status='revoked') WITH CHECK(user_id=auth.uid());`);
    try{
      const repro=h.probe(`UPDATE memberships SET status='active' WHERE user_id=auth.uid(); ${read('connections')}`,actors.a);
      assert.equal(repro.code,'00000','REACTIVATION_REPRO_SQL');assert.equal(repro.rows.length,1,'REACTIVATION_REPRO_CONNECTIONS');
      assert.throws(()=>selfReactivateOracle(h,actors.a),/SELF_REACTIVATE_STATUS/);
      t.diagnostic('MUTANT_SELF_REACTIVATE_KILLED: valid UPDATE restored connections in transaction');
    }finally{h.sql(`DROP POLICY mutant_reactivate ON memberships; REVOKE UPDATE(status) ON memberships FROM authenticated; UPDATE memberships SET status='active' WHERE user_id=${q(actors.a.id)};`);}
    await check();
    for(const operation of ['INSERT','OVERWRITE','UPDATE','MOVE','DELETE']){
      // Write-only INSERT mutant must die without granting foreign SELECT.
      const command=operation==='INSERT'?'INSERT':operation==='DELETE'?'DELETE':'UPDATE';
      h.sql(`CREATE POLICY mutant_write ON storage.objects FOR ${command} TO authenticated ${command==='INSERT'?'WITH CHECK(true)':command==='DELETE'?'USING(true)':'USING(true) WITH CHECK(true)'};`);
      if(command!=='INSERT')h.sql('CREATE POLICY mutant_target_read ON storage.objects FOR SELECT TO authenticated USING(true);');
      // Storage upload/replace (POST upsert and PUT), like move, also checks
      // INSERT on its destination. Without that defect the API still rejects
      // the request through RLS, never exercising the cross-tenant assertion.
      if(['MOVE','OVERWRITE','UPDATE'].includes(operation))h.sql('CREATE POLICY mutant_move_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(true);');
      try{await assert.rejects(()=>storageWriteOracle(h,actors,{operation}),new RegExp('STORAGE_CROSS_'+operation));t.diagnostic('MUTANT_STORAGE_'+operation+'_KILLED');}
      finally{h.sql('DROP POLICY mutant_write ON storage.objects; DROP POLICY IF EXISTS mutant_target_read ON storage.objects; DROP POLICY IF EXISTS mutant_move_insert ON storage.objects;');}
    }
    await check();
  });
  for(const mode of ['content','metadata'])await t.test('mutant: authorized RPC ID with foreign '+mode,async()=>{
    rpc(mode);
    try{await assert.rejects(()=>serviceOracle(h,f,actors),/RPC_OWN_PAYLOAD_LEAK:a/);}
    finally{rpc();}
    await check();
  });
  await t.test('mutant: Storage membership omitted exposes foreign objects',async()=>{
    h.sql('CREATE POLICY mutant ON storage.objects FOR SELECT TO authenticated USING(true);');
    try{await assert.rejects(()=>serviceOracle(h,f,actors),/STORAGE_DENY:(200|206)/);}
    finally{h.sql('DROP POLICY mutant ON storage.objects;');}
    await check();
  });
});
