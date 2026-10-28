import test from 'node:test';import assert from 'node:assert/strict';
import {clientIp,createEmailAdmission} from '../src/lib/email-auth/admission.ts';
test('canonical address has one admission per minute, including concurrent attempts',()=>{let time=0;const a=createEmailAdmission(()=>time),first=a.reserve(' SYN@example.invalid ');assert.ok(first);assert.equal(a.reserve('syn@EXAMPLE.invalid'),null);first.finish();assert.equal(a.reserve('syn@example.invalid'),null);time=60000;assert.ok(a.reserve('syn@example.invalid'));});
test('bounded concurrent admissions and idempotent release',()=>{const a=createEmailAdmission(()=>0),leases=Array.from({length:8},(_,i)=>a.reserve(`SYN-${i}@example.invalid`));assert.ok(leases.every(Boolean));assert.equal(a.reserve('SYN-next@example.invalid'),null);leases[0].finish();leases[0].finish();assert.ok(a.reserve('SYN-next@example.invalid'));assert.equal(a.reserve('SYN-over@example.invalid'),null);});
test('unavailable upstream opens circuit without disclosing account existence',()=>{let time=0;const a=createEmailAdmission(()=>time),first=a.reserve('SYN-known@example.invalid');assert.ok(first);first.finish(true);assert.equal(a.reserve('SYN-other@example.invalid'),null);time=14999;assert.equal(a.reserve("SYN-other@example.invalid"),null);assert.equal(a.bloqueado(),true);time=15000;assert.equal(a.bloqueado(),false);assert.ok(a.reserve('SYN-other@example.invalid'));});
test('distinct address churn cannot grow storage or forwarding unboundedly',()=>{let time=0;const a=createEmailAdmission(()=>time);for(let i=0;i<256;i++){const lease=a.reserve(`SYN-${i}@example.invalid`);assert.ok(lease);lease.finish();}assert.equal(a.reserve('SYN-257@example.invalid'),null);time=60000;assert.ok(a.reserve('SYN-257@example.invalid'));});
// AUTH-03 / R-03 (auditoría 28-oct): la saturación ya no se disfraza de 202 y una IP no agota el cupo de todos.
test('cupo global agotado: busy con Retry-After (ya no el 202 silencioso); el duplicado sigue siendo duplicado',()=>{let time=0;const a=createEmailAdmission(()=>time);
 for(let i=0;i<256;i++){const r=a.admit(`SYN-${i}@example.invalid`);assert.equal(r.kind,'lease');r.lease.finish();}
 const full=a.admit('SYN-257@example.invalid');assert.equal(full.kind,'busy');assert.ok(full.retryAfterSeconds>=1&&full.retryAfterSeconds<=60);
 assert.equal(a.admit('SYN-0@example.invalid').kind,'duplicate');
 time=60000;assert.equal(a.admit('SYN-257@example.invalid').kind,'lease');});
test('ocho solicitudes en vuelo: busy con Retry-After; circuito abierto: busy con el tiempo restante',()=>{let time=0;const a=createEmailAdmission(()=>time),leases=Array.from({length:8},(_,i)=>a.admit(`SYN-${i}@example.invalid`).lease);
 assert.deepEqual(a.admit('SYN-x@example.invalid'),{kind:'busy',retryAfterSeconds:10});
 leases[0].finish(true);time=5000;const open=a.admit('SYN-y@example.invalid');assert.equal(open.kind,'busy');assert.equal(open.retryAfterSeconds,10);});
test('límite por IP: la IP atacante se limita a 10 por minuto sin llenar el cupo global y otra IP legítima sigue admitida',()=>{let time=0;const a=createEmailAdmission(()=>time);
 for(let i=0;i<10;i++){const r=a.admit(`SYN-${i}@example.invalid`,'203.0.113.9');assert.equal(r.kind,'lease');r.lease.finish();}
 const limited=a.admit('SYN-10@example.invalid','203.0.113.9');assert.equal(limited.kind,'ip_limited');assert.equal(limited.retryAfterSeconds,60);
 assert.equal(a.admit('SYN-legit@example.invalid','198.51.100.7').kind,'lease');
 time=61000;assert.equal(a.admit('SYN-11@example.invalid','203.0.113.9').kind,'lease');});
test('sin IP confiable no hay cubo compartido y la cabecera se interpreta por primer salto válido',()=>{const a=createEmailAdmission(()=>0);
 for(let i=0;i<20;i++){const r=a.admit(`SYN-${i}@example.invalid`,null);assert.equal(r.kind,'lease');r.lease.finish();}
 const h=v=>({get:n=>n==='x-forwarded-for'?v:null});
 assert.equal(clientIp(h('203.0.113.9, 10.0.0.1')),'203.0.113.9');assert.equal(clientIp(h('not-an-ip')),null);assert.equal(clientIp(h(null)),null);assert.equal(clientIp(h('2001:db8::1')),'2001:db8::1');});
