// Rutas /api/pain-points y /api/pain-points/[id]/evidence: validación antes de tocar la base y errores privados.
//   cd apps/web && npm run test:pain-points
import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {painPointsHandler,painEvidenceHandler,painAiHandler} from '../src/lib/pain-points/server';
test('handlers: parámetros inválidos → 400 sin tocar la base; sin configuración → 503 con cabeceras privadas',async()=>{
  const r1=await painPointsHandler(new NextRequest('http://x/api/pain-points?x=1'));assert.equal(r1.status,400);assert.equal((await r1.json()).error.code,'request_rejected');
  const r2=await painEvidenceHandler(new NextRequest('http://x/api/pain-points/P2/evidence?format=pdf'),{id:'P2'});assert.equal(r2.status,400);
  const r3=await painEvidenceHandler(new NextRequest('http://x/api/pain-points/P2/evidence?foo=1'),{id:'P2'});assert.equal(r3.status,400);
  const r4=await painPointsHandler(new NextRequest('http://x/api/pain-points'));assert.equal(r4.status,503);assert.equal((await r4.json()).error.code,'pain_points_unavailable');assert.match(r4.headers.get('cache-control')??'',/no-store/);
});

test('IA (L4): parámetros y método inválidos → 400 sin tocar la base; sin configuración → 503 privado con código propio; jamás llama a un proveedor',async()=>{
  const q=await painAiHandler(new NextRequest('http://x/api/pain-points/P2/ia?x=1'),{id:'P2'});assert.equal(q.status,400);
  const m=await painAiHandler(new NextRequest('http://x/api/pain-points/P2/ia',{method:'DELETE'}),{id:'P2'});assert.equal(m.status,400);
  const g=await painAiHandler(new NextRequest('http://x/api/pain-points/P2/ia'),{id:'P2'});assert.equal(g.status,503);assert.equal((await g.json()).error.code,'pain_points_ia_unavailable');assert.match(g.headers.get('cache-control')??'',/no-store/);
  const p=await painAiHandler(new NextRequest('http://x/api/pain-points/P2/ia',{method:'POST'}),{id:'P2'});assert.equal(p.status,503);
});
