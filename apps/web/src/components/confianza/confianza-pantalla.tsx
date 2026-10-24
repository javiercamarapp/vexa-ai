'use client';
import {RovaqCargando} from '../rovaq-cargando';
import {useMemo} from 'react';
import type {CoverageView} from '../../../../../packages/workspace-service/provenance.mjs';
import type {TrendsView} from '../../../../../packages/workspace-service/trends.mjs';
import {tarjetasFuentes} from '../../lib/legibilidad/fuentes.mjs';
import {useJson} from '../ui/use-json';
import {DatosCabecera} from '../datos/datos-cabecera';
import {DataTable} from '../ui/data-table';
import {KpiLinea,BarraParte} from '../panel-comun/kpi-linea';
import {VentanasLinea} from './ventanas-linea';
import {Button,LinkButton,Arrow} from '../ui/button';
import {Loading} from '../ui/loading';
import {nf} from '../ui/format';
import {ComoSeCalculoProvider,ComoSeCalculoBoton} from './como-se-calculo';
import {bloqueFuentes,bloqueFrescura,bloqueVentanas,queNoSabemos,FACTOR_ALERTA} from './confianza-modelo.mjs';
import type {EntradaComo} from '../hoy/hoy-modelo.mjs';
import './confianza.css';
import '../datos/datos.css';
import '../panel-comun/panel-comun.css';

const acceptFresh=(j:unknown)=>{const d=(j as {data?:{availability?:string;sources?:unknown[];insights?:unknown[]}})?.data;return d&&Array.isArray(d.sources)&&Array.isArray(d.insights)?d:null;};
const acceptCov=(j:unknown)=>{const d=(j as {data?:CoverageView})?.data;return Array.isArray(d?.sources)?d as CoverageView:null;};
const acceptTrends=(j:unknown)=>{const d=(j as {data?:TrendsView})?.data;return d?.conversations&&d?.ledger?d:null;};
const acceptFuga=(j:unknown)=>{const d=(j as {data?:{titular?:unknown;ventanas?:unknown[]}})?.data;return d&&typeof d==='object'&&'titular' in d?d:null;};
const acceptCarga=(j:unknown)=>{const d=(j as {data?:{sla?:unknown}})?.data;return d&&typeof d==='object'&&'sla' in d?d:null;};
const REGLA:EntradaComo={id:'frescura',titulo:'alerta de frescura',clase:'observed',fuente:'Estado de sincronización de cada fuente (source_sync_state)',periodo:null,
 formula:`Cada fuente con cadencia esperada se marca «Atrasada» si pasaron más de 2 veces su cadencia sin un éxito, y «Alerta» si pasaron más de ${FACTOR_ALERTA} veces o si la última corrida falló. Las cargas manuales no tienen cadencia y no generan alerta.`,
 cobertura:null,noSabemos:['Una fuente que nunca corrió aparece «Sin datos», no «Al día».','El Tracker de Excel y los archivos son manuales: su frescura es la de la última carga, no un indicador de salud.']};

const ESTADO_TONO={alerta:'bad',atrasada:'warn',ok:'ok',manual:'off',pausa:'off',sin_datos:'off'} as const;
const Estado=({nivel,children}:{nivel:keyof typeof ESTADO_TONO;children:React.ReactNode})=><span className="pc-estado" data-tono={ESTADO_TONO[nivel]}>{children}</span>;
const Tarjeta=({id,titulo,sub,extra,flush=false,children}:{id:string;titulo:string;sub?:string;extra?:React.ReactNode;flush?:boolean;children:React.ReactNode})=><section className="pc-card" data-flush={flush||undefined} aria-labelledby={id}><header className="pc-card-head"><div><h2 id={id}>{titulo}</h2>{sub&&<p>{sub}</p>}</div>{extra}</header>{children}</section>;

/** «Datos y confianza»: semáforo por fuente, frescura por cifra, cobertura con ventanas y «qué no sabemos» como lista de tareas. Lo que no se sabe pesa lo mismo que lo que sí. */
export function ConfianzaPantalla(){
 const fresh=useJson('/api/freshness',acceptFresh),cov=useJson<CoverageView>('/api/coverage',acceptCov),tr=useJson<TrendsView>('/api/trends',acceptTrends);
 const fuga=useJson('/api/refunds',acceptFuga),carga=useJson('/api/workload',acceptCarga);
 const fuentes=useMemo(()=>bloqueFuentes(fresh.data),[fresh.data]),frescura=useMemo(()=>bloqueFrescura(fresh.data),[fresh.data]);
 const ventanas=useMemo(()=>bloqueVentanas(fuga.data),[fuga.data]),tarjetas=useMemo(()=>tarjetasFuentes(cov.data,tr.data),[cov.data,tr.data]);
 const tareas=useMemo(()=>queNoSabemos({fuga:fuga.data,carga:carga.data,cobertura:cov.data,frescura:fresh.data}),[fuga.data,carga.data,cov.data,fresh.data]);
 const ocupado=fresh.busy||cov.busy||fuga.busy||carga.busy;
 const pendiente=(r:{busy:boolean;data:unknown;error:string})=>r.busy&&!r.data;
 const n=(l:{nivel:string}[],k:string)=>l.filter(x=>x.nivel===k).length;
 const cargadas=tarjetas.filter(t=>t.estado==='cargada').length;
 const kpis=[
  {label:'Fuentes al día',value:fuentes.disponible?nf.format(n(fuentes.filas,'ok'))+' de '+nf.format(fuentes.filas.length):'—',vacio:!fuentes.disponible,c:5,chip:fuentes.disponible&&n(fuentes.filas,'alerta')>0?{texto:n(fuentes.filas,'alerta')+(n(fuentes.filas,'alerta')===1?' alerta':' alertas'),tono:'bad' as const}:undefined,partes:[{label:'Al día',value:n(fuentes.filas,'ok')},{label:'Carga manual',value:n(fuentes.filas,'manual')+n(fuentes.filas,'pausa')+n(fuentes.filas,'sin_datos')},{label:'Atrasadas',value:n(fuentes.filas,'atrasada')},{label:'Alerta',value:n(fuentes.filas,'alerta')}],nota:fuentes.disponible?'HubSpot es la fuente de verdad':'La actualización automática no está activada: las cargas son manuales'},
  {label:'Cifras frescas',value:frescura.disponible?nf.format(n(frescura.filas,'ok'))+' de '+nf.format(frescura.filas.length):'—',vacio:!frescura.disponible,c:3,chip:(frescura.alertas??0)>0?{texto:frescura.alertas+(frescura.alertas===1?' alerta':' alertas'),tono:'bad' as const}:undefined,partes:[{label:'Al día',value:n(frescura.filas,'ok')},{label:'Parciales',value:n(frescura.filas,'atrasada')},{label:'Fallaron',value:n(frescura.filas,'alerta')}],nota:'Alerta si pasa más de '+FACTOR_ALERTA+' veces la cadencia esperada'},
  {label:'Cobertura',value:cov.data?nf.format(cargadas)+' de '+nf.format(tarjetas.length):'—',vacio:!cov.data,c:1,partes:[{label:'Cargadas',value:cargadas},{label:'Sin cargar',value:tarjetas.length-cargadas}],nota:'Fuentes con datos cargados; cada una con su corte'},
  {label:'Qué no sabemos',value:ocupado&&!tareas.length?'—':nf.format(tareas.length),vacio:ocupado&&!tareas.length,c:2,chip:tareas.length>0?{texto:'Tareas',tono:'warn' as const}:{texto:'Sin huecos conocidos',tono:'ok' as const},partes:[{label:'Con tarea',value:tareas.length}],nota:tareas[0]?.titulo??'Lo no respondido no se cuenta como completo'}];
 if((fresh.busy||cov.busy)&&!fresh.data&&!cov.data&&!fuga.data&&!carga.data&&!tr.data)return <RovaqCargando mensaje=""/>;
 return <ComoSeCalculoProvider><section className="task-page stack dc" aria-label="Datos y confianza">
  <DatosCabecera actual="resumen" title="Datos y confianza" description="De dónde sale cada número, qué tan fresco es, qué cubre y qué todavía no sabemos."/>
  <KpiLinea items={kpis} label="Indicadores de confianza en los datos"/>
   <div className="pc-grid" data-cols="8-4" style={{alignItems:'start'}}>
    <div className="pc-col">
   <Tarjeta id="dc-fuentes" titulo="Semáforo por fuente" sub="Cómo entra cada fuente, cuándo funcionó por última vez y cuándo vuelve a correr" flush extra={<LinkButton href="/connections" size="sm" variant="ghost" icon={<Arrow/>}>Administrar fuentes</LinkButton>}>
    {!pendiente(fresh)&&!fuentes.disponible?<p className="ac-vacio" style={{margin:'0 14px 14px'}}>{fresh.error||'La actualización automática aún no está activada para esta organización: las cargas siguen siendo manuales.'}</p>
     :<DataTable caption="Fuentes conectadas" state={pendiente(fresh)?'loading':'ready'} rowKey={f=>f.clave} rows={fuentes.filas} maxHeight="none" empty={<p className="ac-vacio" style={{margin:'0 14px 14px'}}>Todavía no se registró ninguna sincronización.</p>} columns={[
      {key:'f',header:'Fuente',render:f=><><span className="pc-th-fila">{f.nombre}</span><small className="pc-s" style={{display:'block'}}>{f.metodo}</small></>},
      {key:'e',header:'Estado',render:f=><><Estado nivel={f.nivel}>{f.estado}</Estado>{f.error&&<small className="pc-s" style={{display:'block'}}>{f.error}</small>}</>},
      {key:'x',header:'Último éxito',render:f=>f.exito},{key:'s',header:'Siguiente',render:f=>f.siguiente??'—'},{key:'h',header:'Datos hasta',render:f=>f.hasta??'sin fecha de corte'}]}/>}
   </Tarjeta>
   <Tarjeta id="dc-ventanas" titulo="Cobertura con ventanas" sub={ventanas.disponible?ventanas.linea||'No hay ventanas de exportación registradas.':undefined}>
    {ventanas.disponible?(ventanas.filas.length?<VentanasLinea filas={ventanas.filas}/>:<p className="ac-vacio">No hay ventanas de exportación registradas.</p>)
     :pendiente(fuga)?<Loading compact message="Cargando ventanas…"/>:<p className="ac-vacio">{fuga.status===403?'Las ventanas de exportación del dinero las ven propietarios y analistas.':'Las ventanas de exportación no están disponibles ahora.'}</p>}
   </Tarjeta>
    </div>
    <div className="pc-col">
   <Tarjeta id="dc-frescura" titulo="Frescura por cifra" sub="Cuándo se recalculó cada cifra" extra={<ComoSeCalculoBoton entrada={REGLA}/>}>
    {pendiente(fresh)?<Loading compact message="Cargando frescura…"/>:!frescura.disponible?<p className="ac-vacio">No disponible ahora. Eso no significa que las cifras estén al día.</p>
     :<ul className="pc-lista ui-reset pc-fill" role="list">{frescura.filas.map(f=><li key={f.clave} style={{listStyle:'none'}}><i className="pc-punto" data-tono={ESTADO_TONO[f.nivel]}/><span className="pc-grow"><span className="pc-t">{f.nombre}</span><span className="pc-s">{f.actualizado}{f.pendientes>0?' · faltan '+f.pendientes+' periodos':''} · datos hasta {f.corte??'sin fecha de corte'}</span></span><Estado nivel={f.nivel}>{f.estado}</Estado></li>)}</ul>}
   </Tarjeta>
   <Tarjeta id="dc-cobertura" titulo="Cobertura por fuente" sub="Incorporado frente a lo leído" extra={<LinkButton href="/sources" size="sm" variant="ghost" icon={<Arrow/>}>Ver detalle</LinkButton>}>
    {pendiente(cov)?<Loading compact message="Cargando cobertura…"/>:cov.error&&!cov.data?<p className="ac-vacio">No disponible ahora: {cov.error}</p>
     :<div className="pc-fill">{tarjetas.map(t=><BarraParte key={t.clave} etiqueta={t.nombre} valor={t.estado==='cargada'?t.incorporadas:null} max={Math.max(1,t.leidas)} c={3} fin={t.estado==='cargada'?nf.format(t.incorporadas)+' de '+nf.format(t.leidas):t.estado==='no_disponible'?'No disponible':'Sin cargar'}/>)}</div>}
   </Tarjeta>
    </div>
   </div>
  <Tarjeta id="dc-nosabemos" titulo="Qué no sabemos" sub="Lo que hoy impide calcular o afirmar una cifra, y qué lo cierra" flush>
   <DataTable caption="Qué no sabemos" state={ocupado&&!tareas.length?'loading':'ready'} rowKey={t=>t.clave} rows={tareas} maxHeight="none" empty={<p className="ac-vacio" style={{margin:'0 14px 14px'}}>Con las fuentes que respondieron no hay huecos conocidos. Las que no respondieron no se cuentan como completas.</p>} columns={[
    {key:'q',header:'Qué falta',render:t=><span className="pc-th-fila">{t.titulo}</span>},{key:'a',header:'Cifra que afecta',render:t=>t.afecta},{key:'c',header:'Qué lo cierra',render:t=>t.cierra},{key:'b',header:'Base',render:t=><span className="pc-estado" data-tono="off">{t.base}</span>}]}/>
  </Tarjeta>
 </section></ComoSeCalculoProvider>;
}
