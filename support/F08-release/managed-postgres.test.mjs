// Real managed-owner migration regression. No remote services or customer data.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {launch} from '../../tests/acceptance/support/F01-03/harness.mjs';
import {seed,foreignKeys} from '../../tests/acceptance/support/F01-03/oracles.mjs';
import * as history from '../../tests/acceptance/support/F01-03/source-history/oracles.mjs';
import * as snapshots from '../../tests/acceptance/support/F01-03/snapshot-oracles.mjs';
import * as workspace from '../../tests/acceptance/support/F01-03/workspace-oracles.mjs';
import * as notifications from '../../tests/acceptance/support/F01-03/notification-oracles.mjs';
import * as briefs from '../../tests/acceptance/support/F01-03/brief-oracles.mjs';
import * as recommendations from '../../tests/acceptance/support/F01-03/recommendation-oracles.mjs';
import * as interventions from '../../tests/acceptance/support/F01-03/intervention-oracles.mjs';

test('managed PostgreSQL non-superuser installs schema and restores private notification read capability',{timeout:300000},async t=>{
 const root=process.env.VEXA_CANDIDATE;assert.ok(root);
 const h=await launch({services:true});t.after(()=>h.close());
 assert.deepEqual(h.json("SELECT json_build_object('superuser',rolsuper,'bypass',rolbypassrls) FROM pg_roles WHERE rolname='postgres'"),{superuser:false,bypass:true});
 const files=fs.readdirSync(path.join(root,'supabase/migrations')).filter(n=>/^\d{4}_.*\.sql$/.test(n)).sort();
 for(const file of files.filter(n=>Number(n.slice(0,4))<28))h.sql('SET ROLE postgres;\n'+fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8'));
 // Reproduce the original attribute form without changing an existing migration.
 const header="create function public.syn_managed_parameter_probe() returns text language plpgsql stable security definer set search_path='' set vexa.action='read' as $$begin return current_setting('vexa.action',true);end$$;";
 await t.test('original function SET attribute fails for the actual managed-owner role',()=>{
  assert.throws(()=>h.sql('SET ROLE postgres;\n'+header),/permission denied to set parameter "vexa.action"/);
  assert.equal(h.sql("SELECT count(*) FROM pg_proc WHERE proname='syn_managed_parameter_probe'"),'0');
 });
 for(const file of files.filter(n=>Number(n.slice(0,4))>=28))h.sql('SET ROLE postgres;\n'+fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8'));
 await t.test('all public migrations install as non-superuser without extra parameter grants',()=>{
  assert.equal(files.length,35);
  const value=h.json("SELECT json_build_object('owner',pg_get_userbyid(proowner),'config',proconfig) FROM pg_proc WHERE oid='public.notification_resource_read(uuid,uuid,text,uuid)'::regprocedure");
  assert.equal(value.owner,'postgres');assert.ok(value.config.every(x=>!x.startsWith('vexa.action=')));
  assert.equal(h.sql("SELECT has_parameter_privilege('postgres','vexa.action','SET')"),'f');
 });
 await t.test('runtime identity stays invoker-only without managed Auth schema grants',()=>{
  assert.equal(h.sql("SELECT has_schema_privilege('vexa_backend','auth','USAGE')"),'f');
  assert.equal(h.sql("SELECT prosecdef FROM pg_proc WHERE oid='public.vexa_request_uid()'::regprocedure"),'f');
  const uid='11111111-1111-4111-8111-111111111111';
  assert.equal(h.sql("BEGIN;SET LOCAL ROLE vexa_backend;SELECT set_config('request.jwt.claim.sub','"+uid+"',true);SELECT public.vexa_request_uid();ROLLBACK;").split('\n').at(-1),uid);
  assert.equal(h.sql("BEGIN;SET LOCAL ROLE vexa_backend;SELECT public.vexa_request_uid() IS NULL;ROLLBACK;"),'t');
  assert.equal(h.sql("SELECT has_function_privilege('anon','public.vexa_request_uid()','EXECUTE')"),'f');
 });
 const keys=foreignKeys(h),actors={};for(const key of ['a','b','dual','outsider','viewer','analyst','operator'])actors[key]=await h.user();
 const base=seed(h,actors);history.seedHistory(h,base);const snaps=snapshots.seed(h,base,actors),ws=await workspace.seed(h,base,actors,snaps),b=await briefs.seed(h,base,actors,ws);base.recommendations=await recommendations.seed(h,base,actors,ws);base.interventions=interventions.seed(h,base.recommendations,actors);const fixture=await notifications.seed(h,base,actors,b);
 await t.test('private RLS and no direct runtime access to the read adapter',()=>notifications.schema(h,keys));
 await t.test('current tenant user and role isolation',()=>notifications.access(h,fixture,actors));
 await t.test('preferences CAS and event integrity remain enforced',()=>notifications.integrity(h,fixture,actors));
 await t.test('private scope restores notify/read and rejects missing or NULL capability',()=>notifications.authorization(h,fixture,actors));
 await t.test('all supported resource checks and revocation remain enforced',()=>notifications.resources(h,fixture,actors));
});
