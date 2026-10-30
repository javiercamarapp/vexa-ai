// F1-citas (29-oct): la ficha del problema rotula los vinculos problema-conversacion REGISTRADOS: «sin vinculos todavia» con 0, conteo con parciales/completos, «no disponible» si no se pudo leer.
// Sin DOM: renderToStaticMarkup sobre datos sinteticos (nada real). El boton «Ver origen» es el de la cita (Citation), que ya existe y se prueba en su propio archivo.
//   node --require ./tests/server-only-stub.cjs --import tsx --test tests/fichas/vinculos-ficha.test.tsx
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {SearchParamsContext} from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import {IdiomaProvider} from '../../src/components/i18n/proveedor';
import {ProblemSheet} from '../../src/components/workspace/problem-sheet';
import {es} from '../../src/lib/i18n/es';
import {en} from '../../src/lib/i18n/en';

const P='00000000-0000-4000-8000-000000000001';
const facts=(links:unknown)=>({data:{problemId:P,generatedAt:'2026-10-29T00:00:00Z',class:'observed',label:'SYN: Envio',grupo:null,conversations:3,citations:5,severity:'high',severityMix:null,critical:null,themes:null,
  recommendations:{state:'ok',items:[]},attachments:{state:'unavailable'},links,parts:{catalog:'ok',signals:'ok',meta:'ok'},note:''},busy:false,error:'',status:200,edadMs:null,viejo:false,reload:()=>{}}) as never;
const html=(links:unknown,idioma:'es'|'en'='es')=>renderToStaticMarkup(<SearchParamsContext.Provider value={new URLSearchParams() as never}><IdiomaProvider idioma={idioma}><ProblemSheet id={P} shared="" captured={null} dinero={null} facts={facts(links)}/></IdiomaProvider></SearchParamsContext.Provider>);
const nota=(h:string)=>/<p[^>]*data-vinculos="([a-z]+)"[^>]*>(.*?)<\/p>/s.exec(h);

test('0 vinculos: dice «Sin vínculos todavía» y no muestra ningun conteo como si existiera',()=>{
  const m=nota(html({state:'none',linked:0,withIssue:0,members:3}))!;
  assert.equal(m[1],'none'); assert.match(m[2],/Sin vínculos todavía/); assert.doesNotMatch(m[2],/\d+ de \d+ conversaciones/);
});
test('parcial y completo: informan lo registrado y cuantos traen el hallazgo identificado',()=>{
  assert.match(nota(html({state:'partial',linked:2,withIssue:1,members:3}))![2],/2 de 3 conversaciones del grupo tienen vínculo registrado; 1 con el hallazgo identificado/);
  assert.match(nota(html({state:'complete',linked:3,withIssue:3,members:3}))![2],/Las 3 conversaciones del grupo tienen vínculo registrado; 3 con el hallazgo identificado/);
});
test('no se pudo leer (links null): «No disponible ahora», nunca «sin vínculos»',()=>{
  const m=nota(html(null))!; assert.equal(m[1],'unavailable'); assert.doesNotMatch(m[2],/Sin vínculos todavía/); assert.match(m[2],/No disponible ahora/i);
});
test('en inglés: mismo estado, texto traducido',()=>{
  assert.match(nota(html({state:'none',linked:0,withIssue:0,members:3},'en'))![2],/No links yet/);
});
test('paridad ES/EN de las claves nuevas (mismas variables)',()=>{
  const ks=Object.keys(es).filter(k=>k.startsWith('prob.vinc')),v=(s:string)=>[...s.matchAll(/\{(\w+)\}/g)].map(x=>x[1]).sort().join(',');
  assert.equal(ks.length,4);
  for(const k of ks){const a=(es as Record<string,string>)[k],b=(en as Record<string,string>)[k];assert.ok(b,k);assert.equal(v(a),v(b),k);}
});
