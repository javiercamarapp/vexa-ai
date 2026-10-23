import test from 'node:test';import assert from 'node:assert/strict';
import {esSenalCritica,motivoSenal,resumirSenales,fraseCriticos,etiquetaMotivo,DEFINICION,CATEGORIA_CRITICA} from '../critico.mjs';
import {isCriticalIssue} from '../index.mjs';
test('una señal crítica es severidad alta/crítica o categoría sensible; media y baja no',()=>{
 assert.ok(esSenalCritica({severity:'high',category:'Order: Spare Parts'}));
 assert.ok(esSenalCritica({severity:'critical'}));
 assert.ok(esSenalCritica({severity:'low',category:'Safety: Smoke'}));
 assert.ok(!esSenalCritica({severity:'medium',category:'Order: Spare Parts'}));
 assert.ok(!esSenalCritica({severity:'low',category:null}));assert.ok(!esSenalCritica(null));
});
test('la regla del resumen del espacio de trabajo ES la regla única',()=>{
 for(const r of [{severity:'high'},{severity:'low',category:'Fraud'},{severity:'low',category:'Warranty: Battery'},{severity:'low',category:'burn injury'}])assert.equal(isCriticalIssue(r),esSenalCritica(r));
 assert.ok(CATEGORIA_CRITICA.test('Injury report'));
});
test('motivo: severidad, categoría o ambos',()=>{
 assert.equal(motivoSenal({severity:'high',category:'x'}),'severity');assert.equal(motivoSenal({severity:'low',category:'Privacy'}),'category');
 assert.equal(motivoSenal({severity:'critical',category:'Fraud'}),'both');assert.equal(motivoSenal({severity:'low',category:'x'}),null);
 assert.match(etiquetaMotivo('severity'),/severidad alta/);assert.equal(etiquetaMotivo(null),null);
});
test('resumirSenales cuenta GRUPOS (por pid) y EVIDENCIAS (spans) por separado y da el motivo por grupo',()=>{
 const filas=[
  {pid:'a',category:'Order: Spare Parts',severity:'low',spans:300},   // no crítica
  {pid:'a',category:'Order: Spare Parts',severity:'high',spans:2},    // crítica: grupo a (la severidad del grupo puede ser baja)
  {pid:'b',category:'Safety: Smoke',severity:'low',spans:1},
  {pid:'b',category:'Other',severity:'critical',spans:4},
  {pid:'c',category:'Shipping: Questions',severity:'medium',spans:9},
 ];
 const r=resumirSenales(filas);
 assert.equal(r.grupos,2);assert.equal(r.senales,7);
 assert.deepEqual(r.porGrupo.get('a'),{signals:2,reason:'severity'});
 assert.deepEqual(r.porGrupo.get('b'),{signals:5,reason:'both'});
 assert.ok(!r.porGrupo.has('c'));
 assert.deepEqual(resumirSenales(null),{grupos:0,senales:0,porGrupo:new Map()});
});
test('la frase rotula la unidad de cada cifra (grupos y evidencias) y empieza por el número de grupos',()=>{
 assert.equal(fraseCriticos({grupos:53,senales:120}),'53 grupos de problemas con revisión crítica (120 señales críticas, evidencias)');
 assert.equal(fraseCriticos({grupos:1,senales:1}),'1 grupo de problemas con revisión crítica (1 señal crítica, evidencia)');
 assert.equal(fraseCriticos({grupos:5}),'5 grupos de problemas con revisión crítica');
 assert.match(fraseCriticos({grupos:1234,senales:null}),/^1,234 grupos/);
});
test('la definición explica por qué una severidad baja puede tener una señal crítica',()=>{
 assert.match(DEFINICION.grupo,/severidad baja/);assert.match(DEFINICION.senal,/evidencia/);
});
