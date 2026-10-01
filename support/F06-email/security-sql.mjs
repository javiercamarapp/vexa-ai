import {schema as emailSchema} from '../../tests/acceptance/support/F01-03/email-oracles.mjs';
import {foreignKeys} from '../../tests/acceptance/support/F01-03/oracles.mjs';
import {randomUUID} from 'node:crypto';
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
/** Independent SQL checks inside rollback-only transactions; requires the completed SMTP fixture. */
export async function emailSecuritySql(t,h){
 await t.test('email global schema classification includes exact private capabilities and five FK contracts',()=>emailSchema(h,foreignKeys(h)));
 const key=randomUUID().replaceAll('-','')+randomUUID().replaceAll('-',''),provider='SYN420_'+randomUUID().replaceAll('-',''),event='SYN420_'+randomUUID().replaceAll('-',''),hash='a'.repeat(64);
 const fail=message=>`raise exception '${message}';`;
 const scalar=(query,expected,label)=>`if (${query}) is distinct from ${expected} then ${fail(label)}end if;`;
 const receipt=(eid=event,pid=provider,ph=hash)=>`public.notification_email_receipt(${q(eid)},${q(pid)},'email.delivered','2026-01-01T00:00:00Z'::timestamptz,${q(ph)})`;
 const step=async(name,sql)=>{let error;await t.test(name,()=>{try{h.sql(sql);}catch(e){error=e;throw e;}});if(error)throw error;};
 await step('email SQL capability has least privilege and private reducer cannot be called directly',`BEGIN;
 DO $$DECLARE role_name text;fn text;BEGIN
 FOR role_name IN SELECT unnest(ARRAY['anon','authenticated','service_role','vexa_backend']) LOOP
  FOR fn IN SELECT oid::regprocedure::text FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('notification_email_recipient','notification_email_prepare','notification_email_accepted','notification_email_receipt','notification_email_reduce','notification_email_items_current') LOOP
   IF has_function_privilege(role_name,fn,'EXECUTE') THEN RAISE EXCEPTION 'EMAIL_RPC_EXPOSED:%:%',role_name,fn;END IF;
  END LOOP;
  IF has_table_privilege(role_name,'public.notification_email_receipts','SELECT') OR has_table_privilege(role_name,'public.notification_email_messages','INSERT,UPDATE,DELETE') OR has_table_privilege(role_name,'public.notification_email_suppressions','SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'EMAIL_TABLE_EXPOSED:%',role_name;END IF;
 END LOOP;
 IF has_table_privilege('vexa_email_service','public.notification_email_suppressions','SELECT,INSERT,UPDATE,DELETE') OR has_function_privilege('vexa_email_service','public.notification_email_reduce(text)','EXECUTE') OR has_table_privilege('vexa_email_service','public.notification_email_messages','SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('vexa_email_service','public.notification_email_receipts','SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'EMAIL_SERVICE_DIRECT_DATA_EXPOSED';END IF;
 ${scalar("SELECT count(*) FROM pg_class WHERE oid IN('public.notification_email_messages'::regclass,'public.notification_email_receipts'::regclass,'public.notification_email_suppressions'::regclass) AND relrowsecurity AND relforcerowsecurity",'3','EMAIL_RLS_REQUIRED')}
 END$$;SET LOCAL ROLE vexa_email_service;
 DO $$BEGIN BEGIN PERFORM public.notification_email_reduce('SYN-denied');RAISE EXCEPTION 'EXPECTED_REDUCER_DENIAL';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END$$;ROLLBACK;`);
 await step('email status RLS binds selected tenant and fresh actor membership independently',`BEGIN;
 SELECT set_config('request.jwt.claim.sub',${q(h.A.id)},true),set_config('vexa.tenant_id',${q(h.A.tenant)},true),set_config('vexa.action','read',true);SET LOCAL ROLE vexa_backend;
 DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM public.notification_email_messages WHERE tenant_id=${q(h.A.tenant)}) THEN RAISE EXCEPTION 'OWN_EMAIL_FIXTURE_REQUIRED';END IF;END$$;
 SELECT set_config('vexa.tenant_id',${q(h.B.tenant)},true);DO $$BEGIN IF EXISTS(SELECT 1 FROM public.notification_email_messages WHERE tenant_id=${q(h.A.tenant)}) THEN RAISE EXCEPTION 'FOREIGN_SELECTED_TENANT_VISIBLE';END IF;END$$;
 SELECT set_config('vexa.tenant_id',${q(h.A.tenant)},true),set_config('request.jwt.claim.sub',${q(h.B.id)},true);DO $$BEGIN IF EXISTS(SELECT 1 FROM public.notification_email_messages WHERE tenant_id=${q(h.A.tenant)}) THEN RAISE EXCEPTION 'FOREIGN_PRINCIPAL_VISIBLE';END IF;END$$;
 RESET ROLE;UPDATE public.memberships SET status='revoked' WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)};
 SELECT set_config('request.jwt.claim.sub',${q(h.A.id)},true);SET LOCAL ROLE vexa_backend;
 DO $$BEGIN IF EXISTS(SELECT 1 FROM public.notification_email_messages WHERE tenant_id=${q(h.A.tenant)}) THEN RAISE EXCEPTION 'REVOKED_PRINCIPAL_VISIBLE';END IF;END$$;ROLLBACK;`);
 await step('authenticated event replay is idempotent and conflicting event identity cannot mutate receipt',`BEGIN;SET LOCAL ROLE vexa_email_service;
 DO $$DECLARE a jsonb;b jsonb;BEGIN a:=${receipt()};b:=${receipt()};IF a->>'replay'<>'false' OR b->>'replay'<>'true' THEN RAISE EXCEPTION 'REPLAY_CONTRACT';END IF;
 BEGIN PERFORM ${receipt(event,provider,'b'.repeat(64))};RAISE EXCEPTION 'EXPECTED_HASH_CONFLICT';EXCEPTION WHEN check_violation THEN NULL;END;
 BEGIN PERFORM ${receipt(event,provider+'_other')};RAISE EXCEPTION 'EXPECTED_PROVIDER_CONFLICT';EXCEPTION WHEN check_violation THEN NULL;END;
 END$$;RESET ROLE;DO $$BEGIN ${scalar(`SELECT count(*) FROM public.notification_email_receipts WHERE event_id=${q(event)} AND provider_id=${q(provider)} AND payload_hash=${q(hash)} AND idempotency_key IS NULL`,'1','RECEIPT_CONFLICT_MUTATED')}END$$;ROLLBACK;`);
 await step('orphan receipt binds only internal provider mapping and acceptance does not manufacture delivery',`BEGIN;
 INSERT INTO public.notification_email_messages SELECT (jsonb_populate_record(NULL::public.notification_email_messages,to_jsonb(src)||jsonb_build_object('idempotency_key',${q(key)},'provider_id',NULL,'provider','resend','acceptance','unknown','delivery','unknown','delivery_rank',0,'accepted_at',NULL))).* FROM public.notification_email_messages src WHERE tenant_id=${q(h.A.tenant)} LIMIT 1;
 SET LOCAL ROLE vexa_email_service;SELECT ${receipt()};RESET ROLE;
 DO $$BEGIN ${scalar(`SELECT count(*) FROM public.notification_email_receipts WHERE event_id=${q(event)} AND idempotency_key IS NULL`,'1','ORPHAN_MUST_REMAIN_UNMAPPED')}${scalar(`SELECT delivery FROM public.notification_email_messages WHERE idempotency_key=${q(key)}`,"'unknown'",'ORPHAN_CHANGED_UNRELATED_MESSAGE')}END$$;
 SET LOCAL ROLE vexa_email_service;SELECT public.notification_email_accepted(${q(key)},'resend',${q(provider)});RESET ROLE;
 DO $$BEGIN ${scalar(`SELECT count(*) FROM public.notification_email_receipts WHERE event_id=${q(event)} AND idempotency_key=${q(key)}`,'1','ORPHAN_NOT_BOUND')}${scalar(`SELECT tenant_id::text FROM public.notification_email_messages WHERE idempotency_key=${q(key)}`,q(h.A.tenant),'TENANT_MAPPING_CHANGED')}${scalar(`SELECT delivery FROM public.notification_email_messages WHERE idempotency_key=${q(key)}`,"'delivered'",'SIGNED_RECEIPT_REQUIRED_FOR_DELIVERY')}END$$;ROLLBACK;`);
 return {checks:5,transactions:'rollback-only',source:'independent SQL security oracles420'};
}
