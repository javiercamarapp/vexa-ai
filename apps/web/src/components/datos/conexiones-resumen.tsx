'use client';
import {useMemo} from 'react';
import {useJson} from '../ui/use-json';
import {KpiLinea} from '../panel-comun/kpi-linea';
import {bloqueFuentes,FACTOR_ALERTA} from '../confianza/confianza-modelo.mjs';
import {nf} from '../ui/format';
import {useT} from '../i18n/proveedor';
const accept=(j:unknown)=>{const d=(j as {data?:{availability?:string;sources?:unknown[];insights?:unknown[]}})?.data;return d&&Array.isArray(d.sources)&&Array.isArray(d.insights)?d:null;};
/** Indicadores de /connections a partir de la frescura real de cada fuente: lo que no responde se muestra «—», nunca 0. */
export function ConexionesResumen(){
 const tx=useT(),f=useJson('/api/freshness',accept),b=useMemo(()=>bloqueFuentes(f.data),[f.data]);
 const n=(k:string)=>b.filas.filter(x=>x.nivel===k).length,auto=b.filas.filter(x=>['ok','atrasada','alerta'].includes(x.nivel)),nuevos=b.filas.filter(x=>x.nuevos!==null);
 const v=(x:string)=>b.disponible?x:'—';
 return <KpiLinea label={tx('tr.datos.crIndicadores')} items={[
  {label:tx('tr.datos.crAuto'),value:v(nf.format(n('ok'))+' de '+nf.format(auto.length)),vacio:!b.disponible,c:5,partes:[{label:tx('tr.datos.crAlDia'),value:n('ok')},{label:tx('tr.datos.crAtrasadas'),value:n('atrasada')},{label:tx('tr.datos.crAlerta'),value:n('alerta')}],nota:b.disponible?tx('tr.datos.crCadencia'):tx('tr.datos.crNoActiva')},
  {label:tx('tr.datos.crNuevos'),value:v(nf.format(nuevos.reduce((a,x)=>a+(x.nuevos??0),0))),vacio:!b.disponible,c:3,partes:nuevos.map(x=>({label:x.nombre,value:x.nuevos??0})),nota:tx('tr.datos.crUltimaCorrida')},
  {label:tx('tr.datos.crManuales'),value:v(nf.format(n('manual')+n('sin_datos')+n('pausa'))),vacio:!b.disponible,c:1,partes:[{label:tx('tr.datos.crManual'),value:n('manual')},{label:tx('carga.sinDatos'),value:n('sin_datos')},{label:tx('tr.datos.crPausa'),value:n('pausa')}],nota:tx('tr.datos.crFrescura')},
  {label:tx('tr.datos.crConAlerta'),value:v(nf.format(n('alerta'))),vacio:!b.disponible,c:2,chip:n('alerta')>0?{texto:tx('tr.datos.crRevisar'),tono:'bad'}:{texto:tx('tr.datos.crSinAlertas'),tono:'ok'},partes:[{label:tx('tr.datos.crConAlerta'),value:n('alerta')},{label:tx('tr.datos.crSinAlerta'),value:auto.length-n('alerta')}],nota:tx('tr.datos.crRegla',{n:FACTOR_ALERTA})}]}/>;
}
