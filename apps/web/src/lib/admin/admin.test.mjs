// Pruebas de las correcciones QA3 (vistas de administración): contraste de Conexiones, estados, Histórico, Equipo, login.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const leer=(rel)=>readFileSync(new URL(rel,import.meta.url),'utf8');
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),lin=v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;},L=c=>0.2126*lin(c[0])+0.7152*lin(c[1])+0.0722*lin(c[2]);
const ratio=(a,b)=>{const x=L(a),y=L(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
const tokens=(glob)=>({claro:/(?:^|\n):root \{([^}]*)\}/.exec(glob)[1],oscuro:/:root\[data-theme=dark\] \{([^}]*)\}/.exec(glob)[1]});
const tok=(b,n)=>{const m=new RegExp('--'+n+':\\s*(#[0-9a-fA-F]{6})').exec(b);assert.ok(m,'token '+n);return rgb(m[1]);};
test('QA3-001: la lista de Conexiones fija color y fondo con tokens en una regla que gana a los botones globales',()=>{
 const css=leer('../../components/connections.module.css');
 assert.doesNotMatch(css,/(?<!\.list )\.item[{:\[]/,'.item suelto (0,1,0) pierde contra `.workspace-shell :where(button)` y deja texto claro sobre fondo claro');
 const base=/\.list \.item\{([^}]*)\}/.exec(css)?.[1];assert.ok(base,'regla .list .item');
 assert.match(base,/color:var\(--ink\)/);assert.match(base,/background:var\(--ui-surface\)/);
 const marcada=/\.list \.item\[aria-pressed=true\][^{]*\{([^}]*)\}/.exec(css)?.[1];assert.ok(marcada,'estado seleccionado');
 assert.match(marcada,/color:var\(--ink\)/);assert.match(marcada,/background:var\(--ui-soft\)/);
 assert.match(css,/\.name small\{[^}]*color:var\(--muted\)/);
});
test('QA3-001: tinta y subtítulo de la lista cumplen 4.5:1 sobre superficie y fondo suave, y el borde activo 3:1, en claro y oscuro',()=>{
 for(const [tema,b] of Object.entries(tokens(leer('../../app/globals.css')))){
  for(const fondo of ['ui-surface','ui-soft'])for(const t of ['ink','muted']){const r=ratio(tok(b,t),tok(b,fondo));assert.ok(r>=4.5,`${tema}: ${t} sobre ${fondo} ${r.toFixed(2)}:1`);}
  const r=ratio(tok(b,'ui-focus'),tok(b,'ui-surface'));assert.ok(r>=3,`${tema}: borde activo ${r.toFixed(2)}:1`);
 }
});
import {estadoConexion,agregadoImportaciones,mil} from '../connections/estado.mjs';
import {rejectionBreakdown} from '../../../../../packages/workspace-service/provenance.mjs';
const hubspotSrc=(extra={})=>({key:'hubspot',label:'HubSpot',loaded:true,status:'ok',class:'observed',imports:24,openImports:1,total:16491,incorporated:7930,rejected:8561,pending:0,lastUpdate:'2026-10-22T19:25:00.000Z',detail:[],rejectionNote:null,
 rejectionBreakdown:rejectionBreakdown({total:16491,incorporated:7930,rejected:8561,codes:{ENTITY_METADATA_ONLY:8400,BODY_INCOMPLETE:100,ROLE_AMBIGUOUS:30,OTRO:31}}),...extra});
const csvSrc={key:'csv',label:'Archivos CSV',loaded:true,status:'ok',class:'observed',imports:50,openImports:0,total:482200,incorporated:482136,rejected:64,pending:0,lastUpdate:'2026-10-18T22:34:59.000Z',detail:[],rejectionNote:null};
const salud=(o)=>({id:'x',source:'csv',accountId:'a',connectionStatus:'active',state:'unknown',lastAttempt:null,lastSuccess:null,watermark:null,coverage:null,lagSeconds:null,lagBasis:'time_since_success',permissions:'unknown',errorCode:null,reconnect:null,...o});
test('QA3-002: mil() redondea a «7,9 mil» sin inventar decimales',()=>{assert.equal(mil(7930),'7,9 mil');assert.equal(mil(8091),'8,1 mil');assert.equal(mil(8400),'8,4 mil');assert.equal(mil(950),'950');assert.equal(mil(482136),'482 mil');});
test('QA3-002: CSV con 50 cargas completadas dice «Cargado · 482,136 filas», no «Pendiente»',()=>{
 const e=estadoConexion(salud({source:'csv',state:'unknown'}),[csvSrc,hubspotSrc()]);
 assert.equal(e.estado,'Cargado · 482,136 filas');assert.equal(e.chip,'Cargado');assert.equal(e.ok,true);assert.equal(e.tone,'ok');
 assert.deepEqual([e.ultimo.rotulo,e.ultimo.valor],['Última carga','2026-10-18T22:34:59.000Z']);
});
test('QA3-002: un archivo sin cargas se dice sin cargas y, si la cobertura no se pudo consultar, «sin comprobar» (nunca cero ni cargado)',()=>{
 assert.equal(estadoConexion(salud({source:'xlsx'}),[csvSrc]).chip,'Sin cargas');
 const e=estadoConexion(salud({source:'csv'}),null);assert.equal(e.chip,'Sin comprobar');assert.equal(e.ok,false);assert.doesNotMatch(e.estado,/Cargado|0 filas/);
});
test('QA3-002: HubSpot conectada muestra conversaciones incorporadas, metadatos aparte y nunca «rechazados» sin desglose',()=>{
 const e=estadoConexion(salud({source:'hubspot',state:'partial',coverage:{observed:16491,accepted:7930,rejected:8561}}),[csvSrc,hubspotSrc()]);
 assert.equal(e.estado,'Conectada · importación en curso');assert.equal(e.chip,'Conectada');
 assert.equal(e.lineas[0],'7,9 mil conversaciones incorporadas de ≈8,1 mil con conversación (≈98 %)');
 assert.match(e.lineas[1],/^8,4 mil registros solo de metadatos/);
 assert.equal(e.lineas.join('|').includes('8,561')||/rechazad/i.test(e.lineas.join('|')),false);
 assert.deepEqual([e.ultimo.rotulo,e.ultimo.valor],['Última actualización de datos','2026-10-22T19:25:00.000Z']);
});
test('QA3-002: el último éxito real manda; sin ninguno y sin cobertura se dice que no hay sincronización completa',()=>{
 const e=estadoConexion(salud({source:'hubspot',state:'healthy',lastSuccess:'2026-10-22T10:00:00.000Z'}),[hubspotSrc({openImports:0})]);
 assert.equal(e.estado,'Conectada');assert.deepEqual([e.ultimo.rotulo,e.ultimo.valor],['Último éxito','2026-10-22T10:00:00.000Z']);
 const v=estadoConexion(salud({source:'hubspot',state:'partial',coverage:{observed:16491,accepted:7930,rejected:8561}}),null);
 assert.equal(v.ultimo.valor,null);assert.match(v.ultimo.vacio,/sincronización completa/);assert.doesNotMatch(v.lineas.join(' '),/rechazad/i);
});
test('QA3-002: sin desglose de HubSpot se dice «no disponible» en lugar de rechazados',()=>{
 const e=estadoConexion(salud({source:'hubspot',state:'partial'}),[hubspotSrc({rejectionBreakdown:rejectionBreakdown({total:16491,incorporated:7930,rejected:8561,codes:null})})]);
 assert.match(e.lineas[0],/7,930 de 16,491 filas leídas están incorporadas; el desglose del resto no está disponible ahora/);assert.doesNotMatch(e.lineas.join(' '),/rechazad/i);
});
test('QA3-002: los KPI de Importaciones suman todas las cargas, separan metadatos de defectos y no cuentan lo desglosado como falla',()=>{
 const a=agregadoImportaciones([csvSrc,hubspotSrc(),{...csvSrc,key:'ledger',imports:0,incorporated:85383,rejected:0}]);
 assert.deepEqual(a,{cargas:74,incorporadas:490066,rechazadas:64+161,soloMetadatos:8400,pendientes:0,sinDesglose:0,fuentes:2});
 const b=agregadoImportaciones([hubspotSrc({rejectionBreakdown:rejectionBreakdown({total:16491,incorporated:7930,rejected:8561,codes:null})})]);
 assert.equal(b.sinDesglose,8561);assert.equal(b.rechazadas,0);assert.equal(agregadoImportaciones(null),null);
});
test('QA3-002: el panel de Conexiones deriva su estado del resumen de cobertura y ya no imprime «rechazados» ni el hash a la vista',()=>{
 const t=leer('../../components/connection-health.tsx');
 assert.match(t,/useJson<CoverageView>\('\/api\/coverage'/);assert.match(t,/estadoConexion\(r,sources\)/);
 assert.doesNotMatch(t,/rechazados/);assert.doesNotMatch(t,/Sin sincronización comprobada/);
 assert.match(t,/<details className=\{styles\.tech\}><summary>Detalle técnico<\/summary>/);
 assert.doesNotMatch(t,/Configuración: \{row\.connectionStatus\}/);
});
test('QA3-007: Importaciones totaliza con la cobertura, rotula las cargas listadas y no reutiliza el tooltip de Economía',()=>{
 const t=leer('../../components/import-preview.tsx'),k=leer('../../components/ui/kind-badge.tsx'),c=leer('../../components/ui/stat-card.tsx');
 assert.match(t,/agregadoImportaciones\(coverage\?\.sources\)/);assert.match(t,/Mostrando las \$\{nf\.format\(teamJobs\.length\)\} cargas más recientes/);
 assert.doesNotMatch(t,/cuenta técnica/);assert.doesNotMatch(t,/foot="En las cargas listadas"/);
 assert.match(t,/ref\. \{j\.id\.slice\(0,6\)\}/,'cada trabajo lleva una referencia distinta');
 assert.match(k,/title=\{hint\?\?info\.hint\}/);assert.match(c,/kindHint/);
 const kpis=t.slice(t.indexOf('<div className="stat-grid">'),t.indexOf('<div className="task-columns import-start">'));
 assert.equal((kpis.match(/<StatCard /g)??[]).length,(kpis.match(/kindHint=/g)??[]).length,'todos los KPI de importaciones tienen tooltip propio');
});
