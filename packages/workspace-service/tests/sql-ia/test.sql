-- Cada bloque corre como vexa_backend (rol de la app) con el contexto de sesión que fija createDatabase. ASSERT falla => psql sale con error => run.sh falla.
\set t1 '11111111-1111-1111-1111-111111111111'
\set t2 '22222222-2222-2222-2222-222222222222'
\set owner 'aaaaaaaa-0000-0000-0000-000000000001'
\set analyst 'aaaaaaaa-0000-0000-0000-000000000002'
\set viewer 'aaaaaaaa-0000-0000-0000-000000000003'
\set inactive 'aaaaaaaa-0000-0000-0000-000000000004'
\set outsider 'bbbbbbbb-0000-0000-0000-000000000001'

-- 1) La app NO escribe directo: solo funciones. SELECT sí (con RLS).
begin; set local role vexa_backend;
select set_config('request.jwt.claim.sub',:'owner',true), set_config('vexa.tenant_id',:'t1',true), set_config('vexa.action','import',true) \gset
do $$ declare t text; begin
 foreach t in array array['analysis_runs','analysis_reads','analysis_spend','weekly_report_outbox','report_unsubscribes'] loop
  begin execute format('insert into public.%I select * from public.%I limit 0',t,t); execute format('delete from public.%I',t); assert false,'delete directo permitido en '||t;
  exception when insufficient_privilege then null; end;
 end loop; end $$;
rollback;

-- 2) Tope semanal: viewer ve el estado pero no reserva; analista reserva; el tope de US$5.00 es duro; la misma clave no gasta dos veces.
begin; set local role vexa_backend;
select set_config('request.jwt.claim.sub',:'viewer',true), set_config('vexa.tenant_id',:'t1',true), set_config('vexa.action','read',true) \gset
do $$ begin
 assert (public.analysis_budget_status('11111111-1111-1111-1111-111111111111')->>'remainingMicro')::bigint=5000000,'estado inicial';
 begin perform public.analysis_budget_reserve('11111111-1111-1111-1111-111111111111','k0',100000); assert false,'viewer reservó'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',:'analyst',true), set_config('vexa.action','import',true) \gset
do $$ declare r jsonb; i int; begin
 for i in 1..4 loop r:=public.analysis_budget_reserve('11111111-1111-1111-1111-111111111111','k'||i,1200000); assert (r->>'allowed')::boolean,'reserva '||i; end loop;
 r:=public.analysis_budget_reserve('11111111-1111-1111-1111-111111111111','k5',300000);
 assert not (r->>'allowed')::boolean and r->>'reason'='tope','el 5.1M debe rebotar: '||r::text;
 r:=public.analysis_budget_reserve('11111111-1111-1111-1111-111111111111','k1',1200000);
 assert r->>'reason'='en_curso','misma clave en curso: '||r::text;
 r:=public.analysis_budget_reserve('11111111-1111-1111-1111-111111111111','k6',200000);
 assert (r->>'allowed')::boolean,'exactamente 5.0M cabe';
 r:=public.analysis_budget_status('11111111-1111-1111-1111-111111111111');
 assert (r->>'exhausted')::boolean and (r->>'usedMicro')::bigint=5000000,'agotado: '||r::text;
 -- liquidar con costo real menor libera cupo; null = incierto (cuenta la reserva)
 perform public.analysis_budget_settle('11111111-1111-1111-1111-111111111111','k1',400000);
 perform public.analysis_budget_settle('11111111-1111-1111-1111-111111111111','k2',null);
 r:=public.analysis_budget_status('11111111-1111-1111-1111-111111111111');
 assert (r->>'usedMicro')::bigint=5000000-800000,'usado tras liquidar: '||r::text;
 assert not (r->>'exhausted')::boolean,'ya no agotado';
 assert (select state from public.analysis_spend where run_key='k2')='uncertain','incierto';
 begin perform public.analysis_budget_settle('11111111-1111-1111-1111-111111111111','k1',1); assert false,'doble liquidación'; exception when others then null; end;
 begin perform public.analysis_budget_settle('11111111-1111-1111-1111-111111111111','nada',1); assert false,'clave desconocida'; exception when others then null; end;
 r:=public.analysis_budget_reserve('11111111-1111-1111-1111-111111111111','k1',100000);
 assert r->>'reason'='ya_registrada','una clave liquidada no se reserva otra vez: '||r::text;
end $$;
rollback;

-- 3) Una reserva abandonada (> 10 min) se retoma sin duplicar el gasto.
begin; set local role vexa_backend;
select set_config('request.jwt.claim.sub',:'owner',true), set_config('vexa.tenant_id',:'t1',true), set_config('vexa.action','import',true) \gset
do $$ declare r jsonb; begin
 perform public.analysis_budget_reserve('11111111-1111-1111-1111-111111111111','viejo',900000);
 reset role; update public.analysis_spend set updated_at=now()-interval '11 minutes' where run_key='viejo'; set local role vexa_backend;
 r:=public.analysis_budget_reserve('11111111-1111-1111-1111-111111111111','viejo',900000);
 assert (r->>'allowed')::boolean,'reserva vieja se retoma: '||r::text;
 assert (select count(*) from public.analysis_spend where run_key='viejo')=1 and (public.analysis_budget_status('11111111-1111-1111-1111-111111111111')->>'usedMicro')::bigint=900000,'sin doble gasto';
end $$;
rollback;

-- 4) Corridas: idempotentes por (punto, corte, versión); una lectura ok jamás se sobrescribe; la clase es siempre inferred; otro tenant no ve nada.
begin; set local role vexa_backend;
select set_config('request.jwt.claim.sub',:'analyst',true), set_config('vexa.tenant_id',:'t1',true), set_config('vexa.action','import',true) \gset
do $$ declare v jsonb; begin
 v:=public.analysis_run_save('11111111-1111-1111-1111-111111111111',jsonb_build_object('puntoId','P4~ABC','corte','2026-10-20T00:00:00Z','version','pp-ia-v1','estado','parcial','confianza',0.5,'consenso','{"estado":"incompleto"}'::jsonb,
   'lecturas',jsonb_build_array(jsonb_build_object('rol','causa_raiz','estado','ok','contenido','{"lectura":"a"}'::jsonb,'intento',1,'costoMicro',100000),jsonb_build_object('rol','impacto','estado','invalido','motivoInvalido','json_invalido','contenido','{}'::jsonb,'intento',1,'costoMicro',90000))));
 assert v->>'estado'='parcial' and jsonb_array_length(v->'lecturas')=2,'parcial: '||v::text;
 v:=public.analysis_run_save('11111111-1111-1111-1111-111111111111',jsonb_build_object('puntoId','P4~ABC','corte','2026-10-20T00:00:00Z','version','pp-ia-v1','estado','completo','confianza',0.7,'consenso','{"estado":"acuerdo"}'::jsonb,
   'lecturas',jsonb_build_array(jsonb_build_object('rol','causa_raiz','estado','ok','contenido','{"lectura":"NUEVA"}'::jsonb,'intento',2),jsonb_build_object('rol','impacto','estado','ok','contenido','{"lectura":"b"}'::jsonb,'intento',2,'costoMicro',80000),jsonb_build_object('rol','accion','estado','ok','contenido','{"lectura":"c"}'::jsonb,'intento',1))));
 assert (select count(*) from public.analysis_runs)=1,'una sola corrida (idempotente)';
 assert v->>'estado'='completo','completa: '||v::text;
 assert (select content->>'lectura' from public.analysis_reads where role='causa_raiz')='a','la lectura ok no se sobrescribe';
 assert (select content->>'lectura' from public.analysis_reads where role='impacto')='b' and (select attempt from public.analysis_reads where role='impacto')=2,'la inválida sí se reemplaza';
 assert (select bool_and(kind='inferred') from public.analysis_reads),'siempre inferred';
 begin insert into public.analysis_reads(tenant_id,run_id,role,status,kind) select tenant_id,id,'accion','ok','observed' from public.analysis_runs; assert false,'escritura directa'; exception when insufficient_privilege then null; end;
 begin perform public.analysis_run_save('11111111-1111-1111-1111-111111111111','{"puntoId":"X"}'::jsonb); assert false,'entrada inválida'; exception when others then null; end;
end $$;
select set_config('request.jwt.claim.sub',:'viewer',true), set_config('vexa.action','import',true) \gset
do $$ begin begin perform public.analysis_run_save('11111111-1111-1111-1111-111111111111','{"puntoId":"P1","corte":"c","version":"v","estado":"parcial","lecturas":[]}'::jsonb); assert false,'viewer guardó'; exception when insufficient_privilege then null; end; end $$;
select set_config('request.jwt.claim.sub',:'outsider',true), set_config('vexa.tenant_id',:'t2',true) \gset
do $$ begin
 assert (select count(*) from public.analysis_runs)=0 and (select count(*) from public.analysis_reads)=0,'otro tenant no ve corridas';
 begin perform public.analysis_run_save('11111111-1111-1111-1111-111111111111','{"puntoId":"P1","corte":"c","version":"v","estado":"parcial","lecturas":[]}'::jsonb); assert false,'cruce de tenant'; exception when insufficient_privilege then null; end;
 begin perform public.analysis_budget_reserve('11111111-1111-1111-1111-111111111111','x',1000); assert false,'cruce de tenant (presupuesto)'; exception when insufficient_privilege then null; end;
end $$;
rollback;

-- 5) Reporte semanal: destinatarios sin viewer/inactivos/bajas; vista previa idempotente; claim respeta la baja.
begin; set local role vexa_backend;
select set_config('request.jwt.claim.sub',:'owner',true), set_config('vexa.tenant_id',:'t1',true), set_config('vexa.action','import',true) \gset
do $$ declare r jsonb; a uuid:='aaaaaaaa-0000-0000-0000-000000000001'; b uuid:='aaaaaaaa-0000-0000-0000-000000000002'; id1 uuid; id2 uuid; payload jsonb; begin
 assert jsonb_array_length(public.weekly_recipients('11111111-1111-1111-1111-111111111111'))=2,'dueño y analista';
 payload:=jsonb_build_object('weekStart','2026-10-19','userId',a,'subject','Reporte semanal','html','<p>x</p>','text','x','snapshot','[{"id":"P1","minor":"100"}]'::jsonb);
 r:=public.weekly_report_record('11111111-1111-1111-1111-111111111111',payload); assert (r->>'inserted')::boolean,'primera vez';
 id1:=(r->>'id')::uuid;
 r:=public.weekly_report_record('11111111-1111-1111-1111-111111111111',payload); assert not (r->>'inserted')::boolean and r->>'reason'='ya_existe','idempotente';
 r:=public.weekly_report_record('11111111-1111-1111-1111-111111111111',payload||jsonb_build_object('userId',b)); id2:=(r->>'id')::uuid;
 begin perform public.weekly_report_record('11111111-1111-1111-1111-111111111111',payload||jsonb_build_object('userId','cccccccc-0000-0000-0000-000000000009')); assert false,'no miembro'; exception when others then null; end;
 assert (select count(*) from public.weekly_report_outbox)=2 and (select bool_and(state='preview') from public.weekly_report_outbox),'solo vista previa';
 r:=public.weekly_report_claim('11111111-1111-1111-1111-111111111111',id1); assert (r->>'send')::boolean,'claim ok';
 r:=public.weekly_report_claim('11111111-1111-1111-1111-111111111111',id1); assert not (r->>'send')::boolean,'no se reclama dos veces';
 perform public.weekly_report_mark('11111111-1111-1111-1111-111111111111',id1,'sent');
 assert (select state from public.weekly_report_outbox where id=id1)='sent','marcado enviado';
 -- baja entre vista previa y envío: se suprime
 reset role; insert into public.report_unsubscribes(tenant_id,user_id,scope) values('11111111-1111-1111-1111-111111111111',b,'weekly'); set local role vexa_backend;
 r:=public.weekly_report_claim('11111111-1111-1111-1111-111111111111',id2); assert not (r->>'send')::boolean and r->>'reason'='baja','baja respetada: '||r::text;
 assert (select state from public.weekly_report_outbox where id=id2)='suppressed','suprimido';
 assert jsonb_array_length(public.weekly_recipients('11111111-1111-1111-1111-111111111111'))=1,'la baja sale de destinatarios';
end $$;
select set_config('request.jwt.claim.sub',:'outsider',true), set_config('vexa.tenant_id',:'t2',true) \gset
do $$ begin assert (select count(*) from public.weekly_report_outbox)=0,'otro tenant no ve el outbox'; begin perform public.weekly_recipients('11111111-1111-1111-1111-111111111111'); assert false,'cruce'; exception when insufficient_privilege then null; end; end $$;
rollback;

-- 6) Baja de un clic: sin la acción del endpoint no hace nada; con ella es idempotente, solo para miembros reales y reversible.
begin; set local role vexa_backend;
select set_config('request.jwt.claim.sub','',true), set_config('vexa.action','read',true) \gset
do $$ begin begin perform public.weekly_unsubscribe('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001'); assert false,'sin acción de baja'; exception when insufficient_privilege then null; end; end $$;
select set_config('vexa.action','weekly_unsubscribe',true) \gset
do $$ declare r jsonb; begin
 r:=public.weekly_unsubscribe('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001'); assert (r->>'ok')::boolean and r->>'estado'='baja' and not (r->>'yaEstaba')::boolean,'baja: '||r::text;
 r:=public.weekly_unsubscribe('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001'); assert (r->>'yaEstaba')::boolean,'idempotente';
 r:=public.weekly_unsubscribe('11111111-1111-1111-1111-111111111111','dddddddd-0000-0000-0000-000000000001'); assert not (r->>'ok')::boolean,'no miembro: '||r::text;
 r:=public.weekly_unsubscribe('22222222-2222-2222-2222-222222222222','aaaaaaaa-0000-0000-0000-000000000001'); assert not (r->>'ok')::boolean,'miembro de otro tenant: '||r::text;
 r:=public.weekly_unsubscribe('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',true); assert r->>'estado'='suscrito','resuscribir';
end $$;
rollback;
select 'sql-ok';
