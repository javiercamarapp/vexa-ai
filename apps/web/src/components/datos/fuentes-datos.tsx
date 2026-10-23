'use client';
import {useMemo} from 'react';
import type {CoverageView} from '../../../../../packages/workspace-service/provenance.mjs';
import type {TrendsView} from '../../../../../packages/workspace-service/trends.mjs';
import {EXPLICACION} from '../../../../../packages/workspace-service/datos-hasta.mjs';
import {tarjetasFuentes,identidad} from '../../lib/legibilidad/fuentes.mjs';
import {filasSincronizacion} from '../../lib/legibilidad/sincronizacion.mjs';
import {DatosCabecera} from './datos-cabecera';
import {DataTable} from '../ui/data-table';
import {ErrorState} from '../ui/error-state';
import {Loading} from '../ui/loading';
import {ProgressRing} from '../ui/progress-ring';
import {LinkButton,Arrow,Button,Refresh} from '../ui/button';
import {useJson} from '../ui/use-json';
import {nf,fmtPct} from '../ui/format';
import {KpiLinea,BarraParte} from '../panel-comun/kpi-linea';
import './datos.css';
import '../panel-comun/panel-comun.css';

const acceptCoverage=(j:unknown)=>{const d=(j as {data?:CoverageView})?.data;return Array.isArray(d?.sources)?d as CoverageView:null;};
const acceptTrends=(j:unknown)=>{const d=(j as {data?:TrendsView})?.data;return d?.conversations&&d?.ledger?d:null;};
const acceptFresh=(j:unknown)=>{const d=(j as {data?:{availability?:string;sources?:unknown[];insights?:unknown[]}})?.data;return d&&Array.isArray(d.sources)&&Array.isArray(d.insights)?d:null;};
const TONO={ok:'ok',warn:'warn',bad:'bad',muted:'off',neutral:'off',info:'info'} as const;
const Estado=({tono,children}:{tono:string;children:React.ReactNode})=><span className="pc-estado" data-tono={TONO[tono as keyof typeof TONO]??'off'}>{children}</span>;

/** «Cobertura de datos»: qué tan completo es el dato, hasta cuándo llega cada fuente y cuánto del cliente ya está identificado. Nada se estima: lo que no responde se dice. */
export function FuentesDatos(){
 const cov=useJson<CoverageView>('/api/coverage',acceptCoverage),tr=useJson<TrendsView>('/api/trends',acceptTrends),fr=useJson('/api/freshness',acceptFresh);
 const t=useMemo(()=>tarjetasFuentes(cov.data,tr.data),[cov.data,tr.data]);
 const id=useMemo(()=>identidad(cov.data?.sources.find(s=>s.key==='associations')),[cov.data]);
 const sync=useMemo(()=>filasSincronizacion(fr.data),[fr.data]);
 const cargadas=t.filter(x=>x.estado==='cargada'),conCorte=cargadas.filter(x=>x.datosHasta).length,impo=cargadas.reduce((a,x)=>a+x.importaciones,0),abiertas=cargadas.reduce((a,x)=>a+x.abiertas,0);
 const cargando=cov.busy&&!cov.data,notas=t.filter(x=>x.estado==='cargada'&&(x.nota||x.rangoNota)).map(x=>({clave:x.clave,nombre:x.nombre,texto:[x.nota,x.rangoNota].filter(Boolean).join(' ')}));
 const kpis=[
  {label:'Identidad',value:id?fmtPct(id.bps/100):'—',vacio:!id,c:8,chip:id?{texto:id.estimado?'Estimado':'Observado'}:undefined,partes:id?[{label:'Vinculadas',value:id.vinculadas},{label:'Sin identificar',value:id.sinIdentificar},{label:'Por revisar y retenidas',value:id.porRevisar+id.retenidas}]:undefined,nota:id?nf.format(id.vinculadas)+' de '+nf.format(id.total)+' relaciones ticket–contacto vinculadas':'Los conteos no respondieron: no se estiman'},
  {label:'Fuentes cargadas',value:cov.data?nf.format(cargadas.length)+' de '+nf.format(t.length):'—',vacio:!cov.data,c:8,partes:[{label:'Cargadas',value:cargadas.length},{label:'Sin cargar',value:t.length-cargadas.length}],nota:EXPLICACION.split('.')[0]+'.'},
  {label:'Con fecha de corte',value:cov.data?nf.format(conCorte)+' de '+nf.format(cargadas.length):'—',vacio:!cov.data,c:8,partes:[{label:'Con corte',value:conCorte},{label:'Sin corte',value:cargadas.length-conCorte}],nota:'Sin fecha de corte no se afirma hasta cuándo llega'},
  {label:'Importaciones',value:cov.data?nf.format(impo):'—',vacio:!cov.data,c:8,chip:abiertas>0?{texto:abiertas+' en proceso',tono:'warn' as const}:undefined,partes:cargadas.filter(x=>x.importaciones>0).map(x=>({label:x.nombre,value:x.importaciones})),nota:'Cargas por archivo y por conexión en todas las fuentes'}];
 return <section className="task-page stack dn-page" aria-label="Cobertura de datos">
  <DatosCabecera actual="cobertura" title="Cobertura de datos" description="Qué fuentes están cargadas, hasta cuándo llegan y cuánto del cliente ya está identificado." actions={<><Button icon={<Refresh/>} loading={cov.busy} onClick={()=>{cov.reload();tr.reload();fr.reload();}}>Actualizar</Button><LinkButton href="/imports" variant="primary" icon={<Arrow/>}>Importar datos</LinkButton></>}/>
  {cov.error&&!cov.data?<ErrorState title="No disponible ahora" body={cov.error} onRetry={()=>cov.reload()}/>:<>
   <KpiLinea items={kpis} label="Indicadores de cobertura"/>
   <section className="pc-card" data-flush aria-labelledby="co-t"><header className="pc-card-head"><div><h2 id="co-t">Cobertura por fuente</h2><p>Incorporado frente a lo leído, con su corte y su rango</p></div></header>
    <DataTable caption="Cobertura por fuente" state={cargando?'loading':'ready'} rowKey={f=>f.clave} rows={t} maxHeight="none" columns={[
     {key:'f',header:'Fuente',render:f=><span className="pc-th-fila">{f.nombre}</span>},
     {key:'e',header:'Estado',render:f=>f.estado==='cargada'?<Estado tono="ok">Cargada</Estado>:f.estado==='no_disponible'?<Estado tono="warn">No disponible ahora</Estado>:<Estado tono="muted">Sin cargar</Estado>},
     {key:'i',header:'Incorporado',width:'30%',render:f=>f.estado==='cargada'?<BarraParte etiqueta={<>{nf.format(f.incorporadas)} <small className="pc-s" style={{display:'inline'}}>{f.unidad}</small></>} valor={f.leidas>0?f.incorporadas:null} max={Math.max(1,f.leidas)} c={8} estado={f.rechazadas>0||f.pendientes>0?'parcial':'real'} fin={f.bps!==null&&f.leidas>f.incorporadas?fmtPct(f.bps/100):''}/>:'—'},
     {key:'h',header:'Datos hasta',render:f=>f.estado==='cargada'?f.datosHasta??'Sin fecha de corte':'—'},{key:'u',header:'Última carga',render:f=>f.estado==='cargada'?f.ultimaCarga??'Sin carga por archivo':'—'},{key:'r',header:'Rango',render:f=>f.estado==='cargada'?f.rango??'Sin rango registrado':'—'}]}/>
    {(notas.length>0||id)&&<ul className="pc-notas ui-reset" role="list" aria-label="Notas de cobertura">{id&&<li style={{listStyle:'none'}}><b>Identidad.</b> Sin identificar al cliente no se une una conversación con sus pedidos: por eso el dinero por problema aún no está disponible.</li>}{notas.map(n=><li key={n.clave} style={{listStyle:'none'}}><b>{n.nombre}.</b> {n.texto}</li>)}</ul>}
    {tr.error&&<p className="ac-nota" role="status" style={{padding:'8px 14px'}}>Las fechas «datos hasta» y los rangos no están disponibles ahora: {tr.error}</p>}
   </section>
   <div className="pc-grid" data-cols="4-4-4">
    <section className="pc-card" aria-labelledby="ci-t"><header className="pc-card-head"><div><h2 id="ci-t">Cobertura de identidad</h2><p>Cada ticket con su cliente</p></div><LinkButton href="/history" size="sm" variant="ghost" icon={<Arrow/>}>Detalle</LinkButton></header>
     {cargando?<Loading compact message="Cargando identidad…"/>:!id?<p className="ac-vacio">No disponible ahora: no se estima.</p>:<div className="pc-fill" style={{display:'flex',flexDirection:'column',gap:10}}>
      <div style={{display:'flex',alignItems:'center',gap:14}}><ProgressRing value={id.bps/10000} size={72} stroke={8} label={fmtPct(id.bps/100)} title={`${fmtPct(id.bps/100)} de las relaciones ticket–contacto está vinculado`}/><p className="pc-s" style={{margin:0,fontSize:13}}><b style={{color:'var(--ink)',fontSize:18}}>{nf.format(id.vinculadas)}</b><br/>de {nf.format(id.total)} relaciones</p></div>
      <BarraParte etiqueta="Vinculadas" valor={id.vinculadas} max={id.total} c={8} fin={nf.format(id.vinculadas)}/><BarraParte etiqueta="Sin identificar" valor={id.sinIdentificar} max={id.total} c={8} estado="parcial" fin={nf.format(id.sinIdentificar)}/><BarraParte etiqueta="Por revisar" valor={id.porRevisar+id.retenidas} max={id.total} c={8} estado="parcial" fin={nf.format(id.porRevisar+id.retenidas)}/></div>}
    </section>
    <section className="pc-card" aria-labelledby="cs-t" data-testid="estado-sincronizacion"><header className="pc-card-head"><div><h2 id="cs-t">Estado de sincronización</h2><p>Cómo entra cada fuente</p></div></header>
     {fr.busy&&!fr.data?<Loading compact message="Cargando sincronización…"/>:!sync.disponible?<p className="ac-vacio">{fr.error||'La actualización automática aún no está activada para esta organización: las cargas siguen siendo manuales.'}</p>
      :sync.fuentes.length===0?<p className="ac-vacio">Todavía no se registró ninguna sincronización.</p>
      :<ul className="pc-lista ui-reset pc-fill" role="list">{sync.fuentes.map(s=><li key={s.clave} style={{listStyle:'none'}}><i className="pc-punto" data-tono={TONO[s.tono as keyof typeof TONO]??'off'}/><span className="pc-grow"><span className="pc-t">{s.nombre}</span><span className="pc-s">{s.metodo} · {s.exito}{s.siguiente?' · siguiente '+s.siguiente:''}{s.error?' · '+s.error:''}</span></span><Estado tono={s.tono}>{s.estado}</Estado></li>)}</ul>}
    </section>
    <section className="pc-card" aria-labelledby="cc-t2"><header className="pc-card-head"><div><h2 id="cc-t2">Cálculos precalculados</h2><p>Se rehacen al llegar datos nuevos</p></div></header>
     {fr.busy&&!fr.data?<Loading compact message="Cargando cálculos…"/>:sync.calculos.length?<ul className="pc-lista ui-reset pc-fill" role="list">{sync.calculos.map(c=><li key={c.clave} style={{listStyle:'none'}}><span className="pc-grow"><span className="pc-t">{c.nombre}</span><span className="pc-s">{c.actualizado??'sin actualizar'}{c.pendientes>0?' · faltan '+c.pendientes+' periodos':''}</span></span><span className="pc-estado" data-tono="off">{c.estado}</span></li>)}</ul>:<p className="ac-vacio">Sin cálculos registrados todavía.</p>}
    </section>
   </div>
  </>}
 </section>;
}
