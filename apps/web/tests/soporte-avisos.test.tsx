// F3d: aviso de «Ver como» (también al vencer a mitad de un recorrido), pista de plataforma dentro de /platform y administrador sin organizaciones en /sin-acceso.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {SupportBanner} from '../src/components/platform/support-banner';
import {SinAccesoVista} from '../src/components/sin-acceso-vista';
import {IdiomaProvider} from '../src/components/i18n/proveedor';
import {traductor} from '../src/lib/i18n';
import {pasosDe} from '../src/lib/onboarding/catalogo.mjs';
import {pistaDe} from '../src/lib/onboarding/pista.mjs';
import {PathnameContext,SearchParamsContext} from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';

const leer=(rel:string)=>fs.readFileSync(new URL('../'+rel,import.meta.url),'utf8');
const banner=(expiresAt:string,idioma:'es'|'en'='es')=>renderToStaticMarkup(<IdiomaProvider idioma={idioma}><SupportBanner tenantId="t1" tenantName="Cliente" reason="motivo de prueba" expiresAt={expiresAt}/></IdiomaProvider>);

test('banner de Ver como vigente: región informativa con cuenta regresiva y Salir',()=>{
  const html=banner(new Date(Date.now()+10*60_000).toISOString());
  assert.match(html,/role="region"/);assert.doesNotMatch(html,/role="alert"/);
  assert.ok(html.includes(es['soporte.banner.modo'])&&html.includes('Cliente')&&html.includes(es['soporte.banner.salir']));
});
test('banner vencido (también a mitad de un recorrido): alerta clara y botón para volver a la consola, en vez de cambiar de pantalla en silencio',()=>{
  const html=banner(new Date(Date.now()-1000).toISOString());
  assert.match(html,/role="alert"/);assert.match(html,/data-vencida/);
  assert.ok(html.includes(es['soporte.banner.vencida'])&&html.includes(es['soporte.banner.volver']));
  assert.ok(banner(new Date(Date.now()-1000).toISOString(),'en').includes(en['soporte.banner.vencida']));
  const src=leer('src/components/platform/support-banner.tsx');
  assert.match(src,/RETRASO_VUELTA_MS/,'la vuelta automática espera unos segundos');
  assert.doesNotMatch(src,/if \(s === 0\)\s*\{[^}]*salir\(\)/,'ya no navega en el mismo instante en que vence');
});
test('si la pista deja de ser «soporte» con la pantalla abierta, el contexto lo registra y el aviso lo dice',()=>{
  const ctx=leer('src/components/onboarding/contexto.tsx'),chk=leer('src/components/onboarding/checklist.tsx');
  assert.match(ctx,/soporteTerminado/);assert.match(ctx,/pistaAnterior==='soporte'&&pista!=='soporte'/);
  assert.match(chk,/c\.pista==='soporte'\|\|c\.soporteTerminado/);assert.match(chk,/onb\.soporte\.terminada\.titulo/);
  assert.match(es['onb.soporte.terminada.cuerpo'],/consola/);assert.match(en['onb.soporte.terminada.cuerpo'],/console/);
});
test('Ver como sigue siendo un solo aviso: sin acciones, sin enlaces y sin tour; su pista gana a cualquier otra',()=>{
  assert.equal(pasosDe('soporte').length,1);
  assert.equal(pistaDe({rol:'viewer',support:{},platformAdmin:true,enPlataforma:true}),'soporte');
});
test('pista de plataforma: solo dentro de /platform; fuera de ahí (sin organización) no hay tour',()=>{
  assert.equal(pistaDe({platformAdmin:true,enPlataforma:true}),'plataforma');
  assert.equal(pistaDe({platformAdmin:true,enPlataforma:false}),null,'superadmin sin membresías fuera de /platform: sin tour');
  assert.equal(pistaDe({rol:'owner',platformAdmin:true,enPlataforma:false}),'propietario');
  for(const p of pasosDe('plataforma'))assert.match(p.href!,/^\/platform(\/|$)/);
  assert.match(leer('src/app/platform/layout.tsx'),/pista: 'plataforma'/);
});
const sinAcceso=(isAdmin:boolean,inv={pending:[],expired:[]},idioma:'es'|'en'='es')=>renderToStaticMarkup(<PathnameContext.Provider value="/sin-acceso"><SearchParamsContext.Provider value={new URLSearchParams() as never}><SinAccesoVista inv={inv} isAdmin={isAdmin} t={traductor(idioma)}/></SearchParamsContext.Provider></PathnameContext.Provider>);
test('/sin-acceso para administrador de plataforma sin organizaciones: aviso y enlace a la consola, sin recorrido ni botón Guía',()=>{
  const html=sinAcceso(true);
  assert.ok(html.includes(es['onb.ui.superadminSinOrg']));assert.match(html,/href="\/platform"/);assert.ok(html.includes(es['sinacceso.irConsola']));
  assert.doesNotMatch(html,/data-tour|onb-boton|onb-tarjeta|Guía/);
  assert.ok(sinAcceso(true,{pending:[],expired:[]},'en').includes(en['onb.ui.superadminSinOrg']));
});
test('/sin-acceso para quien no es administrador: sin enlace a la consola y con el mensaje de invitaciones',()=>{
  const html=sinAcceso(false);
  assert.doesNotMatch(html,/href="\/platform"/);assert.ok(html.includes(es['sinacceso.nada']));assert.ok(!html.includes(es['onb.ui.superadminSinOrg']));
  assert.match(leer('src/app/sin-acceso/page.tsx'),/SinAccesoVista/);
  assert.doesNotMatch(leer('src/app/sin-acceso/page.tsx'),/OnboardingRaiz/,'esa pantalla no monta el recorrido');
});
