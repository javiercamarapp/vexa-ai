import test from 'node:test';
import assert from 'node:assert/strict';
import {launch,candidateInputs} from '../harness.mjs';
import {seed,schemaOracle,foreignKeys} from '../oracles.mjs';
import {ident} from '../matrix.mjs';
import * as uploads from './oracles.mjs';

test('import_uploads physical mutation controls 0 -> assertion -> 0',{timeout:300000},async t=>{
  const h=await launch({services:true});t.after(()=>h.close());
  for(const sql of candidateInputs(process.env.VEXA_CANDIDATE))h.sql(sql);
  assert.ok(uploads.present(h),'MUTATION_REQUIRES_FIVE_MIGRATIONS');
  const actors={};for(const key of ['a','b','dual','outsider','viewer','analyst','operator'])actors[key]=await h.user();
  const f=seed(h,actors),u=uploads.seedUploads(h,f,actors),fks=foreignKeys(h).filter(fk=>fk.table===uploads.table);
  async function cycle(name,oracle,mutate,restore,expected){
    await t.test(name,()=>{
      oracle();
      try{h.sql(mutate);assert.throws(oracle,e=>e.code==='ERR_ASSERTION'&&e.message.includes(expected),'MUTANT_MUST_FAIL_TARGET_ASSERTION');}
      finally{h.sql(restore);}
      oracle();t.diagnostic(`${name}: 0 -> ERR_ASSERTION:${expected} -> 0`);
    });
  }
  await cycle('RLS disabled',()=>schemaOracle(h),'ALTER TABLE public.import_uploads DISABLE ROW LEVEL SECURITY','ALTER TABLE public.import_uploads ENABLE ROW LEVEL SECURITY','UPLOAD_RLS_DISABLED');
  const policy=h.sql("SELECT pg_get_expr(polqual,polrelid) FROM pg_policy WHERE polrelid='public.import_uploads'::regclass AND polname='upload_member_read'");
  await cycle('owner omitted',()=>uploads.access(h,u,actors),'ALTER POLICY upload_member_read ON public.import_uploads USING(public.vexa_member(tenant_id))',`ALTER POLICY upload_member_read ON public.import_uploads USING(${policy})`,'UPLOAD_OWNER_ONLY:dual');
  for(const fk of fks){
    const definition=h.sql(`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.import_uploads'::regclass AND conname='${fk.name}'`);
    // Deliberately call the physical oracle with the pre-mutation catalog:
    // missing FK must fail through accepted bad data, not missing setup/schema.
    await cycle('physical FK dropped '+fk.parent,()=>uploads.fk(h,u,fk),`ALTER TABLE public.import_uploads DROP CONSTRAINT ${ident(fk.name)}`,`ALTER TABLE public.import_uploads ADD CONSTRAINT ${ident(fk.name)} ${definition}`,`UPLOAD_FK_CROSS:${fk.parent}`);
    await cycle('catalog FK dropped '+fk.parent,()=>schemaOracle(h),`ALTER TABLE public.import_uploads DROP CONSTRAINT ${ident(fk.name)}`,`ALTER TABLE public.import_uploads ADD CONSTRAINT ${ident(fk.name)} ${definition}`,'UPLOAD_FK_COUNT');
  }
  await cycle('unknown public table',()=>schemaOracle(h),'CREATE TABLE public.unclassified_upload_mutant(n integer)','DROP TABLE public.unclassified_upload_mutant','MATRIX: unclassified public table');
  const triggers=()=>h.sql("SELECT jsonb_agg(jsonb_build_array(tgname,tgenabled) ORDER BY tgname) FROM pg_trigger WHERE tgrelid='public.import_uploads'::regclass");
  const before=triggers();for(const fk of foreignKeys(h).filter(fk=>fk.table===uploads.table))uploads.fk(h,u,fk);
  assert.equal(triggers(),before,'UPLOAD_TRIGGER_MODES_RESTORED');
});
