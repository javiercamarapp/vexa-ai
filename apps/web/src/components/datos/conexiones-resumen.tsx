'use client';
import {useMemo} from 'react';
import {useJson} from '../ui/use-json';
import {KpiLinea} from '../panel-comun/kpi-linea';
import {bloqueFuentes,FACTOR_ALERTA} from '../confianza/confianza-modelo.mjs';
import {nf} from '../ui/format';
const accept=(j:unknown)=>{const d=(j as {data?:{availability?:string;sources?:unknown[];insights?:unknown[]}})?.data;return d&&Array.isArray(d.sources)&&Array.isArray(d.insights)?d:null;};
/** Indicadores de /connections a partir de la frescura real de cada fuente: lo que no responde se muestra «—», nunca 0. */
export function ConexionesResumen(){
 const f=useJson('/api/freshness',accept),b=useMemo(()=>bloqueFuentes(f.data),[f.data]);
 const n=(k:string)=>b.filas.filter(x=>x.nivel===k).length,auto=b.filas.filter(x=>['ok','atrasada','alerta'].includes(x.nivel)),nuevos=b.filas.filter(x=>x.nuevos!==null);
 const v=(x:string)=>b.disponible?x:'—';
 return <KpiLinea label="Indicadores de conexiones" items={[
  {label:'Sincronización automática',value:v(nf.format(n('ok'))+' de '+nf.format(auto.length)),vacio:!b.disponible,c:5,partes:[{label:'Al día',value:n('ok')},{label:'Atrasadas',value:n('atrasada')},{label:'Alerta',value:n('alerta')}],nota:b.disponible?'Fuentes con cadencia esperada al día':'Aún no está activada para esta organización'},
  {label:'Registros nuevos',value:v(nf.format(nuevos.reduce((a,x)=>a+(x.nuevos??0),0))),vacio:!b.disponible,c:3,partes:nuevos.map(x=>({label:x.nombre,value:x.nuevos??0})),nota:'En la última corrida de cada fuente'},
  {label:'Cargas manuales',value:v(nf.format(n('manual')+n('sin_datos')+n('pausa'))),vacio:!b.disponible,c:1,partes:[{label:'Manual',value:n('manual')},{label:'Sin datos',value:n('sin_datos')},{label:'En pausa',value:n('pausa')}],nota:'Tracker y archivos: su frescura es la de la última carga'},
  {label:'Con alerta',value:v(nf.format(n('alerta'))),vacio:!b.disponible,c:2,chip:n('alerta')>0?{texto:'Revisar',tono:'bad'}:{texto:'Sin alertas',tono:'ok'},partes:[{label:'Con alerta',value:n('alerta')},{label:'Sin alerta',value:auto.length-n('alerta')}],nota:'Alerta si pasa más de '+FACTOR_ALERTA+' veces la cadencia o la última corrida falló'}]}/>;
}
