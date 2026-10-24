// Requisito del dueño: «siempre que esté cargando la información/la página, sale ÚNICAMENTE el logo animado».
import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
const RAIZ=new URL('../src/',import.meta.url).pathname;
const archivos=(d)=>readdirSync(d).flatMap(n=>{const p=join(d,n);return statSync(p).isDirectory()?archivos(p):[p];});
const tsx=archivos(RAIZ).filter(p=>p.endsWith('.tsx')&&!p.includes('/app/api/'));
const VERBO=/(Cargando|Calculando|Verificando|Consultando|Comprobando|Actualizando)[^<>{}"'`]{0,40}(…|\.\.\.)/;
test('ningún texto de carga visible: solo en aria-label, sr-only, props mensaje/message o comentarios',()=>{
  const mal=[];
  for(const p of tsx){
    if(p.endsWith('rovaq-cargando.tsx'))continue;
    const s=readFileSync(p,'utf8');
    for(const linea of s.split('\n')){
      if(/^\s*(\/\/|\/\*|\*)/.test(linea))continue;
      for(const m of linea.matchAll(/>([^<>{}]*)</g)){
        if(!VERBO.test(m[1]))continue;
        const ant=linea.slice(0,m.index);
        // abre la etiqueta contenedora: <p role="status" className="sr-only">texto</p>
        const etiqueta=ant.slice(ant.lastIndexOf('<'));
        if(/sr-only/.test(etiqueta))continue;
        mal.push(relative(RAIZ,p)+' → '+m[1].trim());
      }
      // textos en expresiones ternarias dentro de JSX: {cond?'Cargando…':…}
      for(const m of linea.matchAll(/\{[^{}]*?['`]([^'`]*(?:Cargando|Calculando|Verificando|Consultando|Comprobando|Actualizando)[^'`]*(?:…|\.\.\.))['`]/g)){
        const previo=linea.slice(Math.max(0,m.index-120),m.index);
        if(/sr-only|aria-label|mensaje=|message=|\/\//.test(previo)||/sr-only/.test(linea.slice(Math.max(0,m.index-80),m.index)))continue;
        if(/(titulo|detalle|texto|mensaje|message|label)\s*[:=]/.test(linea.slice(Math.max(0,m.index-30),m.index+m[0].length)))continue;
        mal.push(relative(RAIZ,p)+' ⇒ '+m[1].trim());
      }
    }
  }
  // Excepciones documentadas: etiquetas de botones durante una acción del usuario y textos solo para lector de pantalla compuestos en ternarias.
  const permitidas=/action-form\.tsx|retention-panel\.tsx|analisis-hallazgos\.tsx|platform\/copilot-panel\.tsx|economic-panel\.tsx|workspace\/executive\.tsx/;
  assert.deepEqual(mal.filter(x=>!permitidas.test(x)),[],'texto de carga visible');
});
test('los esqueletos y la espera larga son solo el logo (sin barras, líneas ni tiempo transcurrido)',()=>{
  const sk=readFileSync(join(RAIZ,'components/ui/skeletons.tsx'),'utf8'),ws=readFileSync(join(RAIZ,'components/ui/wait-status.tsx'),'utf8');
  assert.ok(!/className="skeleton|skel-/.test(sk)&&/RovaqCargando/.test(sk));
  assert.ok(!/wait-bar|wait-elapsed|Llevamos|llevamos/.test(ws)&&/RovaqCargando/.test(ws));
});
test('cada pantalla de página devuelve SOLO el logo en la primera carga (sin encabezado ni tarjetas)',()=>{
  const paginas=['hoy/hoy-pantalla','gaps/gaps-pantalla','refunds/fuga-pantalla','map/mapa-pantalla','workload/carga-pantalla','cfo/cfo-dashboard','datos/economia-resumen','datos/fuentes-datos',
    'confianza/confianza-pantalla','workspace/shared-panel','workspace/detail-panel','problems-panel','explorer/panel','briefs/panel','recommendations/panel','notifications/panel','team-panel',
    'history-panel','connection-health','import-preview','candidates-panel','evaluation-panel','retention-panel','migration-comparison','migration-aliases','association-panel','extraction-panel',
    'job-progress','notifications/delivery-policies','notifications/push-preferences'];
  const sin=paginas.filter(p=>!/return\s*<RovaqCargando mensaje=(""|\{""\})\s*\/>/.test(readFileSync(join(RAIZ,'components',p+'.tsx'),'utf8')));
  assert.deepEqual(sin,[]);
});
test('la revalidación en segundo plano no muestra el logo: el hook compartido nunca vacía datos',()=>{
  const h=readFileSync(join(RAIZ,'components/ui/use-auto-refresh.ts'),'utf8');
  assert.ok(!/RovaqCargando|setData\(null\)/.test(h));
});
