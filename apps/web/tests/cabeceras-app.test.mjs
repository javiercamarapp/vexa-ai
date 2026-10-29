// Cabeceras de seguridad (cierre 29-oct): las base cubren todo; las extra solo al host de la app, nunca al sitio público.
//   node --import tsx --test tests/cabeceras-app.test.mjs
import test from 'node:test';import assert from 'node:assert/strict';
import mod from '../next.config.ts';const cfg=mod.default??mod;
const reglas=await cfg.headers();
const hdrs=(r)=>Object.fromEntries(r.headers.map(h=>[h.key,h.value]));
const base=reglas.find(r=>r.source==='/:path*'&&!r.has);
const app=reglas.find(r=>r.source==='/:path*'&&r.has?.some(h=>h.type==='host'&&h.value==='app.rovaq.ai'));
test('base global: HSTS de un año con subdominios, nosniff, DENY, Referrer-Policy, Permissions-Policy, COOP y CSP con frame-ancestors/object-src',()=>{
  const h=hdrs(base);
  assert.match(h['Strict-Transport-Security'],/max-age=31536000; includeSubDomains$/);assert.equal(h['X-Content-Type-Options'],'nosniff');assert.equal(h['X-Frame-Options'],'DENY');
  assert.equal(h['Referrer-Policy'],'strict-origin-when-cross-origin');assert.match(h['Permissions-Policy'],/camera=\(\)/);assert.equal(h['Cross-Origin-Opener-Policy'],'same-origin');
  assert.match(h['Content-Security-Policy'],/frame-ancestors 'none'/);assert.match(h['Content-Security-Policy'],/object-src 'none'/);
});
test('extra solo para el host de la aplicación: CORP same-origin, sin políticas cruzadas',()=>{
  assert.ok(app,'regla con has host app.rovaq.ai');const h=hdrs(app);
  assert.equal(h['Cross-Origin-Resource-Policy'],'same-origin');assert.equal(h['X-Permitted-Cross-Domain-Policies'],'none');
});
test('ninguna regla sin filtro de host añade CORP: el sitio público (rovaq.ai) no cambia',()=>{
  for(const r of reglas.filter(r=>!r.has))assert.ok(!r.headers.some(h=>h.key==='Cross-Origin-Resource-Policy'),r.source);
});
test('la política de exportaciones de briefs sigue más estricta (sandbox)',()=>{
  const r=reglas.find(r=>r.source==='/api/briefs/:id/export');assert.match(hdrs(r)['Content-Security-Policy'],/sandbox/);
});
test('HSTS con preload solo para los hosts de rovaq.ai (app, www y apex), nunca en la regla base',()=>{
  const r=reglas.find(r=>r.has?.some(h=>h.type==='host'&&/rovaq/.test(h.value))&&r.headers.some(h=>h.key==='Strict-Transport-Security'));
  assert.ok(r);assert.match(r.headers.find(h=>h.key==='Strict-Transport-Security').value,/; preload$/);
  const re=new RegExp('^'+r.has[0].value+'$');for(const ok of ['rovaq.ai','www.rovaq.ai','app.rovaq.ai'])assert.ok(re.test(ok),ok);for(const no of ['rovaq-ai.vercel.app','evilrovaq.ai','rovaq.ai.evil.com'])assert.ok(!re.test(no),no);
});
