'use client';
import {useT} from '../i18n/proveedor';
import {RovaqCargando} from '../rovaq-cargando';
import {useMemo} from 'react';
import type {CoverageView} from '../../../../../packages/workspace-service/provenance.mjs';
import type {TrendsView} from '../../../../../packages/workspace-service/trends.mjs';
import {tarjetasFuentes} from '../../lib/legibilidad/fuentes.mjs';
import {useJson} from '../ui/use-json';
import {ConMarca} from '../ui/brand-mark';
import {DatosCabecera} from '../datos/datos-cabecera';
import {DataTable} from '../ui/data-table';
import {KpiLinea,BarraParte} from '../panel-comun/kpi-linea';
import {VentanasLinea} from './ventanas-linea';
import {LinkButton,Arrow} from '../ui/button';
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
const ESTADO_TONO={alerta:'bad',atrasada:'warn',ok:'ok',manual:'off',pausa:'off',sin_datos:'off'} as const;
const Estado=({nivel,children}:{nivel:keyof typeof ESTADO_TONO;children:React.ReactNode})=><span className="pc-estado" data-tono={ESTADO_TONO[nivel]}>{children}</span>;
const Tarjeta=({id,titulo,sub,extra,flush=false,children}:{id:string;titulo:string;sub?:string;extra?:React.ReactNode;flush?:boolean;children:React.ReactNode})=><section className="pc-card" data-flush={flush||undefined} aria-labelledby={id}><header className="pc-card-head"><div><h2 id={id}>{titulo}</h2>{sub&&<p>{sub}</p>}</div>{extra}</header>{children}</section>;

/** «Datos y confianza»: semáforo por fuente, frescura por cifra, cobertura con ventanas y «qué no sabemos» como lista de tareas. Lo que no se sabe pesa lo mismo que lo que sí. */
export function ConfianzaPantalla(){
 const tx=useT();
 const REGLA:EntradaComo={id:'frescura',titulo:tx('conf.reglaTitulo'),clase:'observed',fuente:tx('conf.reglaFuente'),periodo:null,formula:tx('conf.reglaFormula',{n:FACTOR_ALERTA}),cobertura:null,noSabemos:[tx('conf.reglaNo1'),tx('conf.reglaNo2')]};
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
  {label:tx('conf.kAlDia'),value:fuentes.disponible?tx('conf.deN',{a:nf.format(n(fuentes.filas,'ok')),b:nf.format(fuentes.filas.length)}):'—',vacio:!fuentes.disponible,c:5,chip:fuentes.disponible&&n(fuentes.filas,'alerta')>0?{texto:n(fuentes.filas,'alerta')+' '+(n(fuentes.filas,'alerta')===1?tx('conf.alerta'):tx('conf.alertas')),tono:'bad' as const}:undefined,partes:[{label:tx('conf.pAlDia'),value:n(fuentes.filas,'ok')},{label:tx('conf.pManual'),value:n(fuentes.filas,'manual')+n(fuentes.filas,'pausa')+n(fuentes.filas,'sin_datos')},{label:tx('conf.pAtrasadas'),value:n(fuentes.filas,'atrasada')},{label:tx('conf.pAlerta'),value:n(fuentes.filas,'alerta')}],nota:fuentes.disponible?tx('conf.hubspotVerdad'):tx('conf.autoNoActiva')},
  {label:tx('conf.kFrescas'),value:frescura.disponible?tx('conf.deN',{a:nf.format(n(frescura.filas,'ok')),b:nf.format(frescura.filas.length)}):'—',vacio:!frescura.disponible,c:3,chip:(frescura.alertas??0)>0?{texto:frescura.alertas+' '+(frescura.alertas===1?tx('conf.alerta'):tx('conf.alertas')),tono:'bad' as const}:undefined,partes:[{label:tx('conf.pAlDia'),value:n(frescura.filas,'ok')},{label:tx('conf.pParciales'),value:n(frescura.filas,'atrasada')},{label:tx('conf.pFallaron'),value:n(frescura.filas,'alerta')}],nota:tx('conf.alertaSi',{n:FACTOR_ALERTA})},
  {label:tx('conf.kCobertura'),value:cov.data?tx('conf.deN',{a:nf.format(cargadas),b:nf.format(tarjetas.length)}):'—',vacio:!cov.data,c:1,partes:[{label:tx('conf.pCargadas'),value:cargadas},{label:tx('conf.pSinCargar'),value:tarjetas.length-cargadas}],nota:tx('conf.notaCob')},
  {label:tx('conf.kNoSabemos'),value:ocupado&&!tareas.length?'—':nf.format(tareas.length),vacio:ocupado&&!tareas.length,c:2,chip:tareas.length>0?{texto:tx('conf.tareas'),tono:'warn' as const}:{texto:tx('conf.sinHuecos'),tono:'ok' as const},partes:[{label:tx('conf.pConTarea'),value:tareas.length}],nota:tareas[0]?.titulo??tx('conf.notaNoSab')}];
 if((fresh.busy||cov.busy)&&!fresh.data&&!cov.data&&!fuga.data&&!carga.data&&!tr.data)return <RovaqCargando mensaje=""/>;
 return <ComoSeCalculoProvider><section className="task-page stack dc" aria-label={tx('conf.sec')}>
  <DatosCabecera actual="resumen" title={tx('conf.titulo')} description={tx('conf.desc')}/>
  <KpiLinea items={kpis} label={tx('conf.kpisAria')}/>
   <div className="pc-grid" data-cols="8-4" style={{alignItems:'start'}}>
    <div className="pc-col">
   <Tarjeta id="dc-fuentes" titulo={tx('conf.cSemaforo')} sub={tx('conf.cSemaforoD')} flush extra={<LinkButton href="/connections" size="sm" variant="ghost" icon={<Arrow/>}>{tx('conf.adminFuentes')}</LinkButton>}>
    {!pendiente(fresh)&&!fuentes.disponible?<p className="ac-vacio" style={{margin:'0 14px 14px'}}>{fresh.error||tx('conf.autoNoActivaOrg')}</p>
     :<DataTable caption={tx('conf.fuentesCon')} state={pendiente(fresh)?'loading':'ready'} rowKey={f=>f.clave} rows={fuentes.filas} maxHeight="none" empty={<p className="ac-vacio" style={{margin:'0 14px 14px'}}>{tx('conf.sinSync')}</p>} columns={[
      {key:'f',header:tx('conf.hFuente'),render:f=><><span className="pc-th-fila"><ConMarca marca={f.clave}>{f.nombre}</ConMarca></span><small className="pc-s" style={{display:'block'}}>{f.metodo}</small></>},
      {key:'e',header:tx('conf.hEstado'),render:f=><><Estado nivel={f.nivel}>{f.estado}</Estado>{f.error&&<small className="pc-s" style={{display:'block'}}>{f.error}</small>}</>},
      {key:'x',header:tx('conf.hUltimo'),render:f=>f.exito},{key:'s',header:tx('conf.hSiguiente'),render:f=>f.siguiente??'—'},{key:'h',header:tx('conf.hDatosHasta'),render:f=>f.hasta??tx('conf.sinFechaCorte')}]}/>}
   </Tarjeta>
   <Tarjeta id="dc-ventanas" titulo={tx('conf.cVentanas')} sub={ventanas.disponible?ventanas.linea||tx('conf.sinVentanas'):undefined}>
    {ventanas.disponible?(ventanas.filas.length?<VentanasLinea filas={ventanas.filas}/>:<p className="ac-vacio">{tx('conf.sinVentanas')}</p>)
     :pendiente(fuga)?<Loading compact message={tx('conf.cargandoVent')}/>:<p className="ac-vacio">{fuga.status===403?tx('conf.ventanas403'):tx('conf.ventanasNo')}</p>}
   </Tarjeta>
    </div>
    <div className="pc-col">
   <Tarjeta id="dc-frescura" titulo={tx('conf.cFrescura')} sub={tx('conf.cFrescuraD')} extra={<ComoSeCalculoBoton entrada={REGLA}/>}>
    {pendiente(fresh)?<Loading compact message={tx('conf.cargandoFresc')}/>:!frescura.disponible?<p className="ac-vacio">{tx('conf.frescNoDisp')}</p>
     :<ul className="pc-lista ui-reset pc-fill" role="list">{frescura.filas.map(f=><li key={f.clave} style={{listStyle:'none'}}><i className="pc-punto" data-tono={ESTADO_TONO[f.nivel]}/><span className="pc-grow"><span className="pc-t">{f.nombre}</span><span className="pc-s">{f.actualizado}{f.pendientes>0?' · '+tx('conf.faltanPer',{n:f.pendientes}):''} · {tx('conf.datosHastaN',{x:f.corte??tx('conf.sinFechaCorte')})}</span></span><Estado nivel={f.nivel}>{f.estado}</Estado></li>)}</ul>}
   </Tarjeta>
   <Tarjeta id="dc-cobertura" titulo={tx('conf.cCobFuente')} sub={tx('conf.cCobFuenteD')} extra={<LinkButton href="/sources" size="sm" variant="ghost" icon={<Arrow/>}>{tx('conf.verDetalle')}</LinkButton>}>
    {pendiente(cov)?<Loading compact message={tx('conf.cargandoCob')}/>:cov.error&&!cov.data?<p className="ac-vacio">{tx('conf.noDispAhora',{x:cov.error})}</p>
     :<div className="pc-fill">{tarjetas.map(t=><BarraParte key={t.clave} etiqueta={<ConMarca marca={t.clave}>{t.nombre}</ConMarca>} valor={t.estado==='cargada'?t.incorporadas:null} max={Math.max(1,t.leidas)} c={3} fin={t.estado==='cargada'?tx('conf.deN',{a:nf.format(t.incorporadas),b:nf.format(t.leidas)}):t.estado==='no_disponible'?tx('conf.noDisp'):tx('conf.pSinCargar')}/>)}</div>}
   </Tarjeta>
    </div>
   </div>
  <Tarjeta id="dc-nosabemos" titulo={tx('conf.cNoSab')} sub={tx('conf.cNoSabD')} flush>
   <DataTable caption={tx('conf.cNoSab')} state={ocupado&&!tareas.length?'loading':'ready'} rowKey={t=>t.clave} rows={tareas} maxHeight="none" empty={<p className="ac-vacio" style={{margin:'0 14px 14px'}}>{tx('conf.noSabVacio')}</p>} columns={[
    {key:'q',header:tx('conf.hQueFalta'),render:t=><span className="pc-th-fila">{t.titulo}</span>},{key:'a',header:tx('conf.hCifra'),render:t=>t.afecta},{key:'c',header:tx('conf.hCierra'),render:t=>t.cierra},{key:'b',header:tx('conf.hBase'),render:t=><span className="pc-estado" data-tono="off">{t.base}</span>}]}/>
  </Tarjeta>
 </section></ComoSeCalculoProvider>;
}
