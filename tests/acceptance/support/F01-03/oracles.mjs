import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {definitions,relations,ordered,fixture,insert,q,ident,freshRow} from './matrix.mjs';
import {denied,rows,read,write} from './harness.mjs';
import * as uploads from './import-uploads/oracles.mjs';
import * as history from './source-history/oracles.mjs';
export const A='00000000-0000-4000-8000-00000000000a',B='00000000-0000-4000-8000-00000000000b';
export function identityOracle(h,actors) {
  rows(h.probe(read('organizations'),actors.a),[A],'ORG_READ_A');
  rows(h.probe(read('organizations'),actors.b),[B],'ORG_READ_B');
  rows(h.probe(read('organizations'),actors.dual),[A,B],'ORG_READ_AB');
  for(const actor of [null,actors.outsider])denied(h.probe(read('organizations'),actor),'ORG_NO_MEMBERSHIP');
  denied(h.probe(read('memberships'),null),'MEMBERSHIP_ANON');
  denied(h.probe(read('memberships'),actors.outsider),'MEMBERSHIP_OUTSIDER');
  const member=h.probe(read('memberships'),actors.a);
  assert.equal(member.code,'00000','MEMBERSHIP_POSITIVE');
  assert.deepEqual(member.rows.map(x=>[x.tenant_id,x.user_id]),[[A,actors.a.id]],'MEMBERSHIP_ISOLATION');
  for(const actor of [null,actors.outsider,actors.a,actors.viewer]){
    denied(h.probe(write(insert('organizations',{id:randomUUID(),name:'ATTACK'})),actor),'ORG_INSERT');
    denied(h.probe(write(`UPDATE organizations SET name='ATTACK' WHERE id=${q(B)}`),actor),'ORG_UPDATE');
    denied(h.probe(write(`DELETE FROM organizations WHERE id=${q(B)}`),actor),'ORG_DELETE');
    denied(h.probe(write(insert('memberships',{tenant_id:B,user_id:actors.outsider.id,role:'owner',status:'active'})),actor),'MEMBERSHIP_INSERT');
    denied(h.probe(write(`UPDATE memberships SET role='owner' WHERE user_id=${q(actors.b.id)}`),actor),'MEMBERSHIP_UPDATE');
    denied(h.probe(write(`DELETE FROM memberships WHERE user_id=${q(actors.b.id)}`),actor),'MEMBERSHIP_DELETE');
  }
  // Backend provisioning is the allowed positive control for these tables.
  rows(h.probe(write(insert('organizations',{id:randomUUID(),name:'SYN positive'}))),[0],'ORG_BACKEND_INSERT');
  rows(h.probe(write(`UPDATE organizations SET name='SYN positive' WHERE id=${q(A)}`)),[A],'ORG_BACKEND_UPDATE');
  rows(h.probe(write(insert('memberships',{tenant_id:B,user_id:actors.outsider.id,role:'viewer',status:'active'}))),[0],'MEMBERSHIP_BACKEND_INSERT');
  rows(h.probe(write(`UPDATE memberships SET permissions_version=permissions_version+1 WHERE user_id=${q(actors.a.id)}`)),[0],'MEMBERSHIP_BACKEND_UPDATE');
  // Use the outsider's real Auth identity but a membership with no children.
  // Restore outsider status before any later authorization/Storage oracle.
  h.sql(insert('memberships',{tenant_id:A,user_id:actors.outsider.id,role:'viewer',status:'active'})+';');
  try{rows(h.probe(write(`DELETE FROM memberships WHERE tenant_id=${q(A)} AND user_id=${q(actors.outsider.id)}`)),[0],'MEMBERSHIP_BACKEND_DELETE');}
  finally{h.sql(`DELETE FROM memberships WHERE tenant_id=${q(A)} AND user_id=${q(actors.outsider.id)};`);}
  denied(h.probe(read('memberships'),actors.outsider),'MEMBERSHIP_OUTSIDER_RESTORED');
  const leaf=randomUUID();h.sql(insert('organizations',{id:leaf,name:'SYN leaf'})+';');
  try{rows(h.probe(write(`DELETE FROM organizations WHERE id=${q(leaf)}`)),[leaf],'ORG_BACKEND_DELETE');}finally{h.sql(`DELETE FROM organizations WHERE id=${q(leaf)};`);}
}
export function schemaOracle(h) {
  const tables=h.json(`SELECT jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,'nonnull',a.attnotnull,'unique',EXISTS(SELECT 1 FROM pg_constraint u WHERE u.conrelid=c.oid AND u.contype IN ('p','u') AND (SELECT array_agg(att.attname::text ORDER BY att.attname) FROM pg_attribute att WHERE att.attrelid=u.conrelid AND att.attnum=ANY(u.conkey))=ARRAY['id','tenant_id']))) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname='tenant_id' WHERE n.nspname='public' AND c.relkind='r';`);
  for(const [table] of definitions){
    const row=tables.find(x=>x.name===table);assert.ok(row,`SCHEMA_MISSING:${table}`);
    assert.equal(row.rls,true,`RLS_DISABLED:${table}`);assert.equal(row.nonnull,true,`TENANT_NULLABLE:${table}`);
    assert.equal(row.unique,true,`UNIQUE_TENANT_ID:${table}`);
  }
  // Extra private tables cannot silently escape the functional matrix.
  const hasUploads=tables.some(x=>x.name===uploads.table);
  assert.deepEqual(tables.filter(x=>!['organizations','memberships',...(hasUploads?[uploads.table]:[]),...history.present(h)].includes(x.name)).map(x=>x.name).sort(),definitions.map(([n])=>n).sort(),'MATRIX: unclassified public table; extend external exam before freeze');
  const fks=foreignKeys(h);
  if(hasUploads)uploads.schema(h,fks);
  history.schema(h,fks);
  for(const {table,column,parent} of relations)
    assert.ok(fks.some(fk=>fk.table===table && fk.parent===parent && fk.validated && fk.mapping.tenant_id==='tenant_id' && fk.mapping[column]==='id'),`FK_MISSING:${table}.${column}->${parent}`);
  for(const fk of fks){
    assert.ok(fk.validated,`FK_NOT_VALIDATED:${fk.name}`);
    const organizationLink=fk.parent==='organizations' && Object.keys(fk.mapping).length===1 && fk.mapping.tenant_id==='id';
    assert.ok(organizationLink || (fk.parent!=='organizations' && fk.mapping.tenant_id==='tenant_id'),
      `FK_UNCLASSIFIED:${fk.table}->${fk.parent}:${JSON.stringify(fk.mapping)}`);
  }
  return fks;
}
export function foreignKeys(h) {
  return h.json(`SELECT coalesce(jsonb_agg(jsonb_build_object('name',c.conname,'validated',c.convalidated,'match',c.confmatchtype,'nullable',
    (SELECT coalesce(jsonb_agg(x.attname),'[]'::jsonb) FROM unnest(c.conkey) z(a) JOIN pg_attribute x ON x.attrelid=c.conrelid AND x.attnum=z.a WHERE NOT x.attnotnull), 'table',src.relname,'parent',dst.relname,'mapping',
    (SELECT jsonb_object_agg(x.attname,y.attname) FROM unnest(c.conkey,c.confkey) z(a,b)
     JOIN pg_attribute x ON x.attrelid=c.conrelid AND x.attnum=z.a
     JOIN pg_attribute y ON y.attrelid=c.confrelid AND y.attnum=z.b))), '[]'::jsonb)
    FROM pg_constraint c JOIN pg_class src ON src.oid=c.conrelid JOIN pg_namespace sn ON sn.oid=src.relnamespace
    JOIN pg_class dst ON dst.oid=c.confrelid JOIN pg_namespace dn ON dn.oid=dst.relnamespace
    WHERE c.contype='f' AND sn.nspname='public' AND dn.nspname='public';`);

}
// A nullable MATCH SIMPLE component can break an insertion dependency without
// changing required columns. Prefer an ordinary topological step; only defer on
// deadlock. These links remain null in seeds and are populated by each FK oracle.
export function seedStep(pending,edges,done) {
  const unresolved=table=>edges.filter(fk=>fk.table===table&&!done.has(fk.parent));
  const nullable=fk=>fk.match==='s' ? fk.nullable.filter(col=>!['id','tenant_id'].includes(col)) : [];
  let table=pending.find(table=>unresolved(table).length===0);
  if(table)return {table,nulls:[]};
  table=pending.find(table=>unresolved(table).every(fk=>nullable(fk).length>0));
  assert.ok(table,'FIXTURE_UNSUPPORTED_FK_CYCLE: no nullable MATCH SIMPLE cut; explicit external fixture required');
  return {table,nulls:[...new Set(unresolved(table).map(fk=>nullable(fk)[0]))]};
}
export function seed(h,actors) {
  h.sql(insert('organizations',{id:A,name:'SYN A'})+';'+insert('organizations',{id:B,name:'SYN B'})+';');
  for(const [key,actor] of Object.entries(actors)){
    for(const tenant of key==='dual'?[A,B]:key==='outsider'?[]:[key==='b'?B:A])h.sql(insert('memberships',{tenant_id:tenant,user_id:actor.id,role:['viewer','analyst','operator'].includes(key)?key:'owner',status:'active'})+';');
  }
  const a=fixture(A),b=fixture(B);
  // Catalog, not migration text, supplies additional edges and column mappings.
  const edges=foreignKeys(h).filter(fk=>fk.parent!=='organizations');
  const pending=definitions.map(([table])=>table),done=new Set(['memberships']);
  const parents=Object.fromEntries([['a',A],['b',B]].map(([side,tenant])=>[side,{memberships:h.json(`SELECT to_jsonb(m) FROM memberships m WHERE tenant_id=${q(tenant)} AND user_id=${q(actors[side].id)};`)}]));
  while(pending.length){
    const {table,nulls}=seedStep(pending,edges,done);
    pending.splice(pending.indexOf(table),1);
    for(const [side,rows] of Object.entries({a,b})){
      for(const fk of edges.filter(fk=>fk.table===table && done.has(fk.parent)))for(const [col,ref] of Object.entries(fk.mapping)){
        const parent=rows[fk.parent]??parents[side][fk.parent];
        assert.ok(parent && ref in parent,`FIXTURE_MISSING_REFERENCED_COLUMN:${fk.name}:${ref}`);
        rows[table][col]=parent[ref];
      }
      for(const col of nulls)rows[table][col]=null;
      h.sql(insert(table,rows[table])+';');
      // Read defaults/domain values from the catalog-backed fixture, never SQL source.
      rows[table]=h.json(`SELECT to_jsonb(r) FROM ${ident(table)} r WHERE id=${q(rows[table].id)};`);
    }
    done.add(table);
  }
  Object.defineProperty(a,'memberships',{value:parents.a.memberships});
  Object.defineProperty(b,'memberships',{value:parents.b.memberships});
  return {a,b};
}
export function tableOracle(h,table,f,actors) {
  const {a,b}=f;
  const snapshot=()=>h.json(`SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.${ident(table)} r;`);
  const before=snapshot();
  for(const key of ['a','viewer','analyst','operator'])rows(h.probe(read(table),actors[key]),[a[table].id],`READ_A:${table}:${key}`);
  rows(h.probe(read(table),actors.b),[b[table].id],`READ_B:${table}`);
  rows(h.probe(read(table),actors.dual),[a[table].id,b[table].id],`READ_AB:${table}`);
  const fresh=(tenant)=>freshRow((tenant===A?a:b)[table]);
  // Insert/delete on a leaf clone: dependent fixtures cannot mask authorization.
  const immutable=table==='audit_events';
  const appendOnly=table==='message_revisions'&&history.present(h).includes('source_heads');
  const disposable=immutable?a[table]:fresh(A);if(!immutable)h.sql(insert(table,disposable)+';');
  try {
    for(const actor of [null,actors.outsider,actors.a,actors.viewer,actors.analyst,actors.operator]) {
      if(!actor||actor===actors.outsider)denied(h.probe(read(table),actor),`NO_MEMBERSHIP:${table}`);
      denied(h.probe(write(insert(table,fresh(B))),actor),`INSERT_B:${table}`);
      denied(h.probe(write(`UPDATE public.${ident(table)} SET updated_at=updated_at+interval '1 second' WHERE id=${q(b[table].id)}`),actor),`UPDATE_B:${table}`);
      // B leaf clone is needed for DELETE: no unrelated FK may count as denial.
      const leaf=immutable?b[table]:fresh(B);if(!immutable)h.sql(insert(table,leaf)+';');
      try {denied(h.probe(write(`DELETE FROM public.${ident(table)} WHERE id=${q(leaf.id)}`),actor),`DELETE_B:${table}`);}finally{if(!immutable)h.sql(`DELETE FROM public.${ident(table)} WHERE id=${q(leaf.id)};`);}
    }
    for(const key of ['a','viewer','analyst','operator']){
      if(table==='connections' && key==='a')continue;
      for(const operation of ['INSERT','UPDATE','DELETE'])ownWriteOracle(h,table,operation,actors[key],key,fresh(A),disposable.id);
    }
    const allowed=table==='connections'?actors.a:'backend';
    const pos=fresh(A);rows(h.probe(write(insert(table,pos)),allowed),[pos.id],`INSERT_POSITIVE:${table}`);
    if(!immutable&&!appendOnly)rows(h.probe(write(`UPDATE public.${ident(table)} SET updated_at=updated_at+interval '1 second' WHERE id=${q(disposable.id)}`),allowed),[disposable.id],`UPDATE_POSITIVE:${table}`);
    if(!immutable&&!appendOnly)rows(h.probe(write(`DELETE FROM public.${ident(table)} WHERE id=${q(disposable.id)}`),allowed),[disposable.id],`DELETE_POSITIVE:${table}`);
    if(appendOnly)for(const op of ['UPDATE','DELETE'])denied(h.probe(`SET LOCAL ROLE vexa_backend; ${write(op==='UPDATE'?`UPDATE message_revisions SET hash='changed' WHERE id=${q(disposable.id)}`:`DELETE FROM message_revisions WHERE id=${q(disposable.id)}`)}`),'APPEND_ONLY_MESSAGE_HISTORY:'+op);
    const swap=h.probe(write(`UPDATE public.${ident(table)} SET tenant_id=${q(B)} WHERE id=${q(disposable.id)}`),actors.dual);
    // 23503 is deliberately NOT accepted: it can hide a missing immutability rule.
    if(swap.code!=='23514')denied(swap,`TENANT_SWAP:${table}`);
    denied(h.probe(read(table),{...actors.outsider,claims:{user_metadata:{tenant_id:B,role:'owner'}}}),`METADATA:${table}`);
  }finally{if(!immutable)h.sql(`DELETE FROM public.${ident(table)} WHERE id=${q(disposable.id)};`);}
  assert.deepEqual(snapshot(),before,`PERSISTED_EFFECT:${table}`);
}
// Probe valid same-tenant rows without RETURNING; FK/uniqueness failures never count as RBAC denial.
export function ownWriteOracle(h,table,operation,actor,role,fresh,leafId) {
  const statement=operation==='INSERT'?insert(table,fresh):operation==='UPDATE'
    ?`UPDATE public.${ident(table)} SET updated_at=updated_at+interval '1 second' WHERE id=${q(leafId)}`
    :`DELETE FROM public.${ident(table)} WHERE id=${q(leafId)}`;
  denied(h.probe(write(statement),actor),`${operation}_OWN_DENIED:${table}:${role}`);
}
// Test the physical FK, not a domain trigger that happens to reject the same
// write first. USER excludes PostgreSQL's internal RI triggers. This runs only
// as the disposable DB administrator INSIDE h.probe's always-rollback transaction.
// All RLS/role/immutability/Storage probes keep the candidate's triggers enabled.
function physicalFkProbe(h,table,statement) {
  return h.probe(`ALTER TABLE public.${ident(table)} DISABLE TRIGGER USER; ${write(statement)} SET CONSTRAINTS ALL IMMEDIATE;`);
}
export function fkOracle(h,f,relation) {
  const {table,column,parent}=relation;
  const update=id=>physicalFkProbe(h,table,`UPDATE public.${ident(table)} SET ${ident(column)}=${q(id)} WHERE id=${q(f.a[table].id)}`);
  rows(update(f.a[parent].id),[f.a[table].id],`FK_POSITIVE:${table}.${column}`);
  const result=update(f.b[parent].id);
  assert.equal(result.code,'23503',`FK_CROSS:${table}.${column}:${fkDiagnostic(h,table,result)}`);
  assert.ok(result.constraint,`FK_DIAGNOSTIC:${table}.${column}`);
}
// Execute attacks transactionally, inspect their effects before rollback; constraints are not RBAC.
export function selfReactivateOracle(h,actor) {
  const where=`tenant_id=${q(A)} AND user_id=${q(actor.id)}`;
  const before=h.sql(`SELECT row_to_json(m) FROM memberships m WHERE ${where}`);
  for(const [label,set] of [['STATUS',"status='active'"],['ROLE',"role='owner'"],['VERSION','permissions_version=permissions_version+1']]){
    rows(h.probe(write(`UPDATE memberships SET ${set} WHERE ${where}`)),[0],'SELF_BACKEND_VALID_'+label);
    denied(h.probe(write(`UPDATE memberships SET ${set} WHERE ${where}`),actor),'SELF_REACTIVATE_'+label);
  }
  assert.equal(h.sql(`SELECT row_to_json(m) FROM memberships m WHERE ${where}`),before,'REVOKED_STATE_PERSISTENT');
  // A leaf avoids FK/23505 masking DELETE or INSERT permission defects.
  const leaf=randomUUID();h.sql(insert('organizations',{id:leaf,name:'SYN revoked leaf'})+';'+insert('memberships',{tenant_id:leaf,user_id:actor.id,role:'viewer',status:'revoked'})+';');
  try{
    const del=`DELETE FROM memberships WHERE tenant_id=${q(leaf)} AND user_id=${q(actor.id)}`;
    rows(h.probe(write(del)),[0],'SELF_DELETE_BACKEND_VALID');
    denied(h.probe(write(del),actor),'SELF_REVOKED_DELETE');
    h.sql(del+';');
    const add=insert('memberships',{tenant_id:leaf,user_id:actor.id,role:'owner',status:'active'});
    rows(h.probe(write(add)),[0],'SELF_REINSERT_BACKEND_VALID');
    denied(h.probe(write(add),actor),'SELF_REVOKED_REINSERT');
  }finally{h.sql(`DELETE FROM memberships WHERE tenant_id=${q(leaf)};DELETE FROM organizations WHERE id=${q(leaf)};`);}
}
export function revokeOracle(h,f,actors) {
  h.sql(`UPDATE public.memberships SET status='revoked',permissions_version=permissions_version+1 WHERE user_id=${q(actors.a.id)};`);
  selfReactivateOracle(h,actors.a);
  denied(h.probe(read('organizations'),actors.a),'REVOKED_ORGANIZATIONS');
  // Identity may expose one's own revoked record; it must never expose other users.
  const revoked=h.probe(read('memberships'),actors.a);
  assert.ok(revoked.code==='42501'||(revoked.code==='00000' && revoked.rows.every(row=>row.user_id===actors.a.id && row.status==='revoked')),'REVOKED_MEMBERSHIP_ISOLATION');
  for(const [table] of definitions){
    denied(h.probe(read(table),actors.a),`REVOKED_READ:${table}`);
    const clone=freshRow(f.a[table]);
    // Existing identity can cause uniqueness only if RLS incorrectly permits it;
    // uniqueness is NOT accepted as authorization denial.
    denied(h.probe(write(insert(table,clone)),actors.a),`REVOKED_INSERT:${table}`);
    denied(h.probe(write(`UPDATE public.${ident(table)} SET updated_at=updated_at+interval '1 second' WHERE id=${q(f.a[table].id)}`),actors.a),`REVOKED_UPDATE:${table}`);
    denied(h.probe(write(`DELETE FROM public.${ident(table)} WHERE id=${q(f.a[table].id)}`),actors.a),`REVOKED_DELETE:${table}`);
  }
}

// Diagnostic only: keep the exact 23503 oracle, expose real catalog on mismatch.
function fkDiagnostic(h,table,result){
  if(result.code==='23503')return '';
  const catalog=h.json(`SELECT jsonb_build_object('triggers',
    (SELECT jsonb_agg(jsonb_build_object('definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled,'function',p.proname))
      FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE t.tgrelid=${q('public.'+table)}::regclass AND NOT t.tgisinternal),
    'foreign_keys',(SELECT jsonb_agg(jsonb_build_object('name',conname,'validated',convalidated,'definition',pg_get_constraintdef(oid)))
      FROM pg_constraint WHERE conrelid=${q('public.'+table)}::regclass AND contype='f'));`);
  return JSON.stringify({result,catalog});
}

// Every discovered private edge gets a valid INSERT and a foreign-parent INSERT.
// Diagnostics retain the rejecting constraint; mandatory presence is checked separately.
export function discoveredFkOracle(h,f,fk) {
  if(history.tables.includes(fk.table))return history.fk(h,f,fk);
  if(fk.table===uploads.table)return uploads.fk(h,f.importUploads,fk);
  if(fk.parent==='organizations')return; // identity links exercised by identityOracle
  const make=side=>{
    const row=freshRow(f.a[fk.table]);
    for(const [col,ref] of Object.entries(fk.mapping))if(col!=='tenant_id'){
      assert.ok(ref in f[side][fk.parent],`FIXTURE_MISSING_REFERENCED_COLUMN:${fk.name}:${ref}`);
      row[col]=f[side][fk.parent][ref];
    }
    return row;
  };
  rows(physicalFkProbe(h,fk.table,insert(fk.table,make('a'))),[0],`EXTRA_FK_POSITIVE:${fk.name}`);
  const result=physicalFkProbe(h,fk.table,insert(fk.table,make('b')));
  assert.equal(result.code,'23503',`EXTRA_FK_CROSS:${fk.name}:${fkDiagnostic(h,fk.table,result)}`);
  // Redundant safe FKs can reject the same edge; all are catalog-validated above.
  assert.ok(result.constraint,`EXTRA_FK_DIAGNOSTIC:${fk.name}`);
}
