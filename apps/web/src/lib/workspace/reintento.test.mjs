import test from 'node:test';import assert from 'node:assert/strict';
import {pedirConReintento,mensajeDeError,esErrorDeRed,MENSAJE_SIN_CONEXION} from './reintento.mjs';
const espera=(ms,signal)=>new Promise((res,rej)=>{const t=setTimeout(res,ms);signal.addEventListener('abort',()=>{clearTimeout(t);rej(new DOMException('Aborted','AbortError'));});});
test('éxito al primer intento: no avisa ni reintenta',async()=>{
 let avisos=0;const r=await pedirConReintento(async()=>({status:200,json:{a:1}}),{onReintentando:()=>avisos++});
 assert.equal(r.status,200);assert.equal(r.intentos,1);assert.equal(avisos,0);
});
test('un intento que excede el plazo se repite una vez y avisa «Reintentando…»',async()=>{
 const avisos=[];let n=0;
 const r=await pedirConReintento(async s=>{n++;if(n===1){await espera(500,s);}return {status:200,json:{ok:true}};},{plazos:[20,200],onReintentando:i=>avisos.push(i)});
 assert.equal(r.status,200);assert.equal(r.intentos,2);assert.deepEqual(avisos,[1]);
});
test('si ambos intentos exceden el plazo devuelve timedOut (error recién después del reintento)',async()=>{
 const avisos=[];const r=await pedirConReintento(async s=>{await espera(500,s);return {status:200};},{plazos:[10,10],onReintentando:i=>avisos.push(i)});
 assert.equal(r.timedOut,true);assert.equal(r.intentos,2);assert.deepEqual(avisos,[1]);
});
test('5xx y errores de red se reintentan; 4xx y 404 no',async()=>{
 let n=0;let r=await pedirConReintento(async()=>({status:++n===1?502:200}),{plazos:[50,50]});assert.equal(r.status,200);assert.equal(r.intentos,2);
 n=0;r=await pedirConReintento(async()=>{if(++n===1)throw new TypeError('fetch failed');return {status:200};},{plazos:[50,50]});assert.equal(r.intentos,2);
 for(const st of [400,401,403,404]){n=0;r=await pedirConReintento(async()=>{n++;return {status:st};},{plazos:[50,50]});assert.equal(n,1);assert.equal(r.status,st);}
});
test('si el segundo intento también da 5xx se devuelve ese 5xx (el llamador muestra el error)',async()=>{
 const r=await pedirConReintento(async()=>({status:500}),{plazos:[50,50]});assert.equal(r.status,500);assert.equal(r.intentos,2);
});
test('abortar desde fuera no reintenta y relanza',async()=>{
 const c=new AbortController();let n=0;
 const p=pedirConReintento(async s=>{n++;await espera(500,s);return {status:200};},{plazos:[1000,1000],signal:c.signal});
 setTimeout(()=>c.abort(),10);
 await assert.rejects(p,e=>e.name==='AbortError');assert.equal(n,1);
});
test('R2-3-001: «Failed to fetch» se reintenta UNA vez tras una pausa y se traduce; el aviso del reintento lleva la causa',async()=>{
 const causas=[];let n=0;const t0=Date.now();
 const r=await pedirConReintento(async()=>{if(++n===1)throw new TypeError('Failed to fetch');return {status:200};},{plazos:[50,50],esperaMs:40,onReintentando:(i,c)=>causas.push(c)});
 assert.equal(r.intentos,2);assert.ok(Date.now()-t0>=35,'hubo pausa antes del reintento');assert.ok(esErrorDeRed(causas[0]));
 await assert.rejects(pedirConReintento(async()=>{throw new TypeError('Failed to fetch');},{plazos:[50,50],esperaMs:1}),e=>mensajeDeError(e,'x')===MENSAJE_SIN_CONEXION);
 assert.equal(mensajeDeError(new Error('Tu acceso cambió'),'x'),'Tu acceso cambió');assert.doesNotMatch(MENSAJE_SIN_CONEXION,/fetch/i);
});
