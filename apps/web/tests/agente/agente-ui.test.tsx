import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {analizarAdjunto,adjuntoSinContenido,parseCsv,toNumber,validarArchivo,ADJUNTO_MAX_BYTES} from '../../src/components/agente/attachments';
import {applyEvent} from '../../src/components/agente/use-agente';
import {RovaqMark} from '../../src/components/agente/rovaq-mark';
import {TraceDisclosure,LiveTrace,msText} from '../../src/components/agente/trace';
import {BlockView,Kpis} from '../../src/components/agente/blocks';
import {AttachmentCard} from '../../src/components/agente/attachment-card';
import {Composer} from '../../src/components/agente/composer';
import type {Block} from '../../src/components/agente/types';

const cov={known_n:3,eligible_n:4};
const sv=(key:string,value:number|null,display=String(value))=>({key,label:key,value,display});
const block=(chart:Block['chart']):Block=>({tool:'t',title:'Bloque',columns:[{key:'a',label:'A',kind:'text'},{key:'b',label:'B',kind:'integer'}],rows:[{a:'x',b:1},{a:'y',b:2},{a:'z',b:3}],chart,class:'observed',coverage:cov,truncated:false});

test('adjuntos: solo CSV/TXT/JSON de hasta 1 MB, vacíos y otros formatos se rechazan con motivo', () => {
  assert.match(validarArchivo('a.pdf',10)!,/CSV, TXT o JSON/);
  assert.match(validarArchivo('a.csv',0)!,/vacío/);
  assert.match(validarArchivo('a.csv',ADJUNTO_MAX_BYTES+1)!,/1 MB/);
  assert.equal(validarArchivo('A.CSV',ADJUNTO_MAX_BYTES),null);
});
test('CSV: comillas, saltos dentro de comillas, separador ; y BOM; estadística solo de columnas totalmente numéricas', () => {
  assert.deepEqual(parseCsv('﻿a;b\n"x;1";2\n"y\nz";3').rows,[['a','b'],['x;1','2'],['y\nz','3']]);
  const csv='canal,monto,nota\nweb,10,a\nweb,"1,200",b\ntienda,5,\nweb,7,c\ntienda,3,d';
  const r=analizarAdjunto('v.csv',csv,csv.length);assert.ok(r.ok);if(!r.ok)return;
  const m=r.resumen.columns.find(c=>c.name==='monto')!;
  assert.deepEqual([r.resumen.rows,m.numeric?.n,m.numeric?.sum,m.numeric?.max],[5,5,1225,1200]);
  assert.equal(r.resumen.columns.find(c=>c.name==='canal')!.numeric,null);
  assert.equal(r.resumen.columns.find(c=>c.name==='nota')!.missing,1);
  assert.equal(r.resumen.freq?.column,'canal');assert.equal(r.resumen.freq?.rows[0].count,3);
  assert.equal(r.resumen.label,'Dato aportado por el usuario');
});
test('importes con símbolo de moneda o separador ambiguo no se interpretan ni se suman', () => {
  assert.equal(toNumber('$1,200'),null);assert.equal(toNumber('1.200,5'),null);assert.equal(toNumber('12'),12);assert.equal(toNumber('1,234.5'),1234.5);
  const r=analizarAdjunto('m.csv','m,x\n$10,1\n$20,2',17);assert.ok(r.ok);if(r.ok)assert.equal(r.resumen.columns[0].numeric,null);
});
test('JSON de objetos se lee como tabla; JSON inválido o escalar se rechaza; TXT cuenta líneas', () => {
  const j=analizarAdjunto('d.json','[{"a":1,"b":"x"},{"a":2}]',30);assert.ok(j.ok);if(j.ok)assert.deepEqual([j.resumen.rows,j.resumen.columns.map(c=>c.name)],[2,['a','b']]);
  assert.equal(analizarAdjunto('d.json','{',1).ok,false);assert.equal(analizarAdjunto('d.json','[1,2]',5).ok,false);
  const t=analizarAdjunto('n.txt','hola mundo\n\notra línea',22);assert.ok(t.ok);if(t.ok)assert.deepEqual(t.resumen.text,{lines:2,words:4,chars:22});
});
test('lo que se guarda en el historial no contiene el contenido del adjunto', () => {
  const r=analizarAdjunto('s.csv','secreto,x\nconfidencial,1',25);assert.ok(r.ok);if(!r.ok)return;
  assert.ok(!JSON.stringify(adjuntoSinContenido(r.resumen)).includes('confidencial'));
});
test('eventos del servidor -> pasos en vivo: inicio abre, fin cierra con estado/tiempo/cifras; la traza se agrega ya cerrada', () => {
  let s=applyEvent([],{t:'traza',paso:{id:'plan',kind:'plan',label:'Elegí qué consultar',estado:'ok',ms:3,detail:'Reglas'}},{});
  s=applyEvent(s,{t:'paso',fase:'inicio',herramienta:'estado_tracker'},{estado_tracker:'Revisando el Tracker'});
  assert.deepEqual(s.map(x=>[x.kind,x.done]),[['plan',true],['tool',false]]);assert.equal(s[1].label,'Revisando el Tracker');
  s=applyEvent(s,{t:'paso',fase:'fin',herramienta:'estado_tracker',estado:'ok',ms:12,cifras:3,fuentes:['Tracker']},{});
  assert.deepEqual([s[1].done,s[1].estado,s[1].ms,s[1].cifras],[true,'ok',12,3]);
  assert.equal(applyEvent(s,{t:'otro'},{}),s);
});
test('RovaqMark: idle sin órbita, thinking con órbita; el CSS de movimiento vive bajo prefers-reduced-motion', () => {
  assert.ok(!renderToStaticMarkup(<RovaqMark/>).includes('rovaq-orbit'));
  assert.match(renderToStaticMarkup(<RovaqMark thinking/>),/data-state="thinking"[\s\S]*rovaq-orbit/);
  const css=readFileSync(new URL('../../src/components/agente/agente.css',import.meta.url),'utf8');
  assert.equal(css.split('{').length,css.split('}').length,'llaves del CSS desbalanceadas');
  assert.ok(!/@media\(max-width:\d+px\)\{@media/.test(css),'media anidado por error');
  let inMotion=false;
  for(const line of css.split('\n')){
   if(line.startsWith('@media(prefers-reduced-motion:no-preference)'))inMotion=true;else if(line&&!line.startsWith(' ')&&!line.startsWith('}')&&!line.startsWith('@keyframes'))inMotion=false;
   if(line.includes('animation:')||line.includes('transition:'))assert.ok(inMotion||line.includes('prefers-reduced-motion:no-preference'),'movimiento fuera de prefers-reduced-motion: '+line.slice(0,80));
  }
});
test('desglose: muestra herramientas, tiempos y aclara que no es razonamiento de un modelo', () => {
  const html=renderToStaticMarkup(<TraceDisclosure labels={{estado_tracker:'Revisando el Tracker'}} trace={[{id:'plan',kind:'plan',label:'Elegí qué consultar',estado:'ok',ms:2},{id:'tool:1',kind:'tool',tool:'estado_tracker',label:'x',estado:'ok',ms:1500,cifras:3,fuentes:['Tracker (Excel)']}]}/>);
  assert.match(html,/Revisando el Tracker/);assert.match(html,/1\.5 s/);assert.match(html,/Tracker \(Excel\)/);assert.match(html,/No es el razonamiento interno/);
  assert.equal(renderToStaticMarkup(<TraceDisclosure labels={{}} trace={[]}/>),'');assert.equal(msText(null),'');
  const live=renderToStaticMarkup(<LiveTrace phase="Consultando tus datos…" steps={[{id:'tool:1',kind:'tool',tool:'estado_tracker',label:'x',done:false}]} labels={{estado_tracker:'Revisando el Tracker'}}/>);
  assert.match(live,/role="status"/);assert.match(live,/Revisando el Tracker…/);assert.match(live,/aria-expanded="true"/);
});
test('bloques: barra, línea y dona traen su tabla equivalente, clase y cobertura; la dona nunca usa los colores de clase', () => {
  const bar=renderToStaticMarkup(<BlockView block={block({kind:'bar',unit:'u',series:[sv('x',2),sv('y',null,'No disponible')]})}/>);
  assert.match(bar,/No disponible/);assert.match(bar,/Ver como tabla/);assert.match(bar,/Observado/);assert.match(bar,/Cobertura: 3 de 4/);
  const line=renderToStaticMarkup(<BlockView block={block({kind:'line',unit:'u',series:[sv('a',1),sv('b',2),sv('c',3)]})}/>);
  assert.match(line,/area-chart/);assert.match(line,/Ver como tabla/);
  const donut=renderToStaticMarkup(<BlockView block={block({kind:'donut',additive:true,unit:'fuentes',series:[sv('c',2),sv('s',1)]})}/>);
  assert.match(donut,/donut-seg/);assert.ok(!/data-tone="1"|data-tone="2"|data-tone="3"/.test(donut));
  assert.match(renderToStaticMarkup(<Kpis figures={[{id:'f',label:'L',display:'No disponible',value:null,class:'inferred',coverage:cov}]}/>),/No disponible[\s\S]*Inferido/);
});
test('tarjeta de adjunto: rotulada «Dato aportado por el usuario», sin insignias de clase del corte y aclara que el agente no lo lee', () => {
  const r=analizarAdjunto('v.csv','canal,monto\nweb,10\nweb,20\ntienda,5',33);assert.ok(r.ok);if(!r.ok)return;
  const html=renderToStaticMarkup(<AttachmentCard a={r.resumen}/>);
  assert.match(html,/Dato aportado por el usuario/);assert.match(html,/El agente no lee este archivo/);assert.match(html,/Analizado en tu navegador/);
  assert.ok(!/Observado|Estimado|Inferido/.test(html));
});
test('compositor: el botón de adjuntar existe, está activo y solo acepta CSV/TXT/JSON; deshabilitado cuando la conversación llegó al límite', () => {
  const props={value:'',onChange:()=>{},onSend:()=>{},onStop:()=>{},onConsult:()=>{},sending:false,placeholder:'p',maxChars:600,categoriesId:'c',categoriesOpen:false,inputId:'i',onAttach:()=>{},attachError:null};
  const on=renderToStaticMarkup(<Composer {...props} disabled={false}/>);
  assert.match(on,/accept="\.csv,\.txt,\.json/);assert.match(on,/no se envía ni se guarda/);assert.ok(!/<button[^>]*disabled=""[^>]*aria-label="Adjuntar/.test(on));
  assert.match(renderToStaticMarkup(<Composer {...props} disabled attachError="El archivo supera 1 MB."/>),/role="alert"[^>]*>El archivo supera 1 MB/);
});

test('adjuntos: las columnas identificadoras (ticket_id, ids únicos consecutivos) no se suman ni se promedian; la numérica real sí', () => {
  const csv='ticket_id,monto,id_cliente,folio\n1001,10,7,5001\n1002,20,7,5002\n1003,30,9,5003\n1004,5,9,5004\n1005,7,9,5005';
  const r=analizarAdjunto('t.csv',csv,csv.length);assert.ok(r.ok);if(!r.ok)return;
  const col=(n:string)=>r.resumen.columns.find(c=>c.name===n)!;
  assert.equal(col('ticket_id').numeric,null);assert.equal(col('ticket_id').identificador,true);
  assert.equal(col('id_cliente').numeric,null);assert.equal(col('folio').numeric,null,'enteros únicos consecutivos');
  assert.equal(col('monto').numeric?.sum,72);assert.notEqual(col('monto').identificador,true);
  const html=renderToStaticMarkup(<AttachmentCard a={r.resumen}/>);
  assert.doesNotMatch(html,/5,015|1,003/);assert.match(html,/identificador/i);
});

test('«Pregúntale a tus datos» vive en el shell normal: sin encabezado, sin barra lateral propia, sin selector de tema y con panel Historial', () => {
  const read=(r:string)=>readFileSync(new URL(r,import.meta.url),'utf8');
  const chat=read('../../src/components/agente/agente.tsx'),shell=read('../../src/components/workspace/shell.tsx');
  assert.doesNotMatch(chat,/ThemeToggle|ChatSidebar|chat-bar|Espacio de trabajo/);
  assert.match(chat,/<HistoryPanel/);assert.match(chat,/aria-label="Historial de chats"/);
  assert.match(shell,/sinEncabezado=esRutaCopiloto\(pathname\)/);assert.match(shell,/workspace-header" hidden=\{sinEncabezado/);assert.doesNotMatch(shell,/GlobalBar|workspace-top/);
  assert.doesNotMatch(shell,/workspace-bare/);
  const hist=read('../../src/components/agente/historial.tsx');
  assert.match(hist,/ConfirmationDialog/);assert.match(hist,/Buscar chats/);assert.match(hist,/onRename/);
  assert.match(read('../../src/components/agente/answer-view.tsx'),/vincul/);
});
