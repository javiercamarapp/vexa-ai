'use client';
import {RovaqCargando} from '../rovaq-cargando';
import {useMemo} from 'react';
import type {CoverageView} from '../../../../../packages/workspace-service/provenance.mjs';
import type {TrendsView} from '../../../../../packages/workspace-service/trends.mjs';
import {explicacion} from '../../../../../packages/workspace-service/datos-hasta.mjs';
import {tarjetasFuentes,identidad} from '../../lib/legibilidad/fuentes.mjs';
import {filasSincronizacion} from '../../lib/legibilidad/sincronizacion.mjs';
import {agregadoImportaciones,desgloseImportaciones} from '../../lib/connections/estado.mjs';
import {DatosCabecera} from './datos-cabecera';
import {DataTable} from '../ui/data-table';
import {ConMarca} from '../ui/brand-mark';
import {ErrorState} from '../ui/error-state';
import {Loading} from '../ui/loading';
import {ProgressRing} from '../ui/progress-ring';
import {LinkButton,Arrow} from '../ui/button';
import {useJson} from '../ui/use-json';
import {nf,fmtPct} from '../ui/format';
import {useT,useIdioma} from '../i18n/proveedor';
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
 const tx=useT(),idioma=useIdioma(),cov=useJson<CoverageView>('/api/coverage',acceptCoverage),tr=useJson<TrendsView>('/api/trends',acceptTrends),fr=useJson('/api/freshness',acceptFresh);
 const t=useMemo(()=>tarjetasFuentes(cov.data,tr.data,tx),[cov.data,tr.data,tx]);
 const id=useMemo(()=>identidad(cov.data?.sources.find(s=>s.key==='associations')),[cov.data]);
 const sync=useMemo(()=>filasSincronizacion(fr.data,Date.now(),tx),[fr.data,tx]);
 const cargadas=t.filter(x=>x.estado==='cargada'),conCorte=cargadas.filter(x=>x.datosHasta).length,impo=cargadas.reduce((a,x)=>a+x.importaciones,0),abiertas=cargadas.reduce((a,x)=>a+x.abiertas,0),agr=agregadoImportaciones(cov.data?.sources);
 const cargando=cov.busy&&!cov.data,notas=t.filter(x=>x.estado==='cargada'&&(x.nota||x.rangoNota)).map(x=>({clave:x.clave,nombre:x.nombre,texto:[x.nota,x.rangoNota].filter(Boolean).join(' ')}));
 const kpis=[
  {label:tx('tr.datos.fdIdentidad'),value:id?fmtPct(id.bps/100):'—',vacio:!id,c:5,chip:id?{texto:id.estimado?tx('landing.val.est'):tx('hist.observado')}:undefined,partes:id?[{label:tx('tr.datos.fdVinculadas'),value:id.vinculadas},{label:tx('tr.datos.fdSinId'),value:id.sinIdentificar},{label:tx('tr.datos.fdRevRet'),value:id.porRevisar+id.retenidas}]:undefined,nota:id?tx('tr.datos.fdNotaId',{a:nf.format(id.vinculadas),b:nf.format(id.total)}):tx('tr.datos.fdNoRespondio')},
  {label:tx('tr.datos.fdFuentesCarg'),value:cov.data?tx('tr.datos.deN',{a:nf.format(cargadas.length),b:nf.format(t.length)}):'—',vacio:!cov.data,c:3,partes:[{label:tx('tr.datos.fdCargadas'),value:cargadas.length},{label:tx('tr.ui.cbSinCargar'),value:t.length-cargadas.length}],nota:explicacion(idioma).split('.')[0]+'.'},
  {label:tx('tr.datos.fdConFecha'),value:cov.data?tx('tr.datos.deN',{a:nf.format(conCorte),b:nf.format(cargadas.length)}):'—',vacio:!cov.data,c:1,partes:[{label:tx('tr.datos.fdConCorte'),value:conCorte},{label:tx('tr.datos.fdSinCorteP'),value:cargadas.length-conCorte}],nota:tx('tr.datos.fdNotaCorte')},
  {label:tx('tr.datos.fdCargasEspacio'),value:cov.data?nf.format(agr?.cargas??impo):'—',vacio:!cov.data,c:7,chip:abiertas>0?{texto:tx('tr.datos.fdEnProceso',{n:abiertas}),tono:'warn' as const}:undefined,partes:(agr?agr.porFuente.map(x=>({label:x.nombre,value:x.cargas})):cargadas.filter(x=>x.importaciones>0).map(x=>({label:x.nombre,value:x.importaciones}))),nota:agr?tx('tr.datos.fdMisma',{desglose:desgloseImportaciones(agr.porFuente,'cargas')})+(impo>agr.cargas?tx('tr.datos.fdSuman',{n:nf.format(impo-agr.cargas)}):''):tx('tr.datos.fdPorArchivo')}];
 if(cov.busy&&!cov.data&&!cov.error)return <RovaqCargando mensaje=""/>;
 return <section className="task-page stack dn-page" aria-label={tx('tr.datos.fdTitulo')}>
  <DatosCabecera actual="cobertura" title={tx('tr.datos.fdTitulo')} description={tx('tr.datos.fdDesc')} actions={<LinkButton href="/imports" variant="primary" icon={<Arrow/>}>{tx('panel.importar')}</LinkButton>}/>
  {cov.error&&!cov.data?<ErrorState title={tx('hoy.noDisponible')} body={cov.error} onRetry={()=>cov.reload()}/>:<>
   <KpiLinea items={kpis} label={tx('tr.datos.fdIndicadores')}/>
   <section className="pc-card" data-flush aria-labelledby="co-t"><header className="pc-card-head"><div><h2 id="co-t">{tx('tr.datos.cobFuente')}</h2><p>{tx('tr.datos.fdSubFuente')}</p></div></header>
    <DataTable caption={tx('tr.datos.cobFuente')} state={cargando?'loading':'ready'} rowKey={f=>f.clave} rows={t} maxHeight="none" columns={[
     {key:'f',header:tx('conf.hFuente'),render:f=><span className="pc-th-fila"><ConMarca marca={f.clave}>{f.nombre}</ConMarca></span>},
     {key:'e',header:tx('tr.datos.thEstado'),render:f=>f.estado==='cargada'?<Estado tono="ok">{tx('tr.datos.cargada')}</Estado>:f.estado==='no_disponible'?<Estado tono="warn">{tx('hoy.noDisponible')}</Estado>:<Estado tono="muted">{tx('tr.ui.cbSinCargar')}</Estado>},
     {key:'i',header:tx('tr.datos.thIncorporado'),width:'30%',render:f=>f.estado==='cargada'?<BarraParte etiqueta={<>{nf.format(f.incorporadas)} <small className="pc-s" style={{display:'inline'}}>{f.unidad}</small></>} valor={f.leidas>0?f.incorporadas:null} max={Math.max(1,f.leidas)} c={3} estado={f.rechazadas>0||f.pendientes>0?'parcial':'real'} fin={f.bps!==null?fmtPct(f.bps/100):f.leidas>0&&f.incorporadas>=f.leidas?fmtPct(100):'—'}/>:'—'},
     {key:'h',header:tx('tr.datos.thDatosHasta'),render:f=>f.estado==='cargada'?f.datosHasta??tx('tr.datos.sinCorte'):'—'},{key:'u',header:tx('tr.datos.thUltimaCarga'),render:f=>f.estado==='cargada'?f.ultimaCarga??tx('tr.datos.fdSinCargaArchivo'):'—'},{key:'r',header:tx('tr.datos.thRangoC'),render:f=>f.estado==='cargada'?f.rango??tx('tr.datos.sinRango'):'—'}]}/>
    <p className="pc-ley" role="note"><span><i/>{tx('tr.datos.fdLeyCompleto')}</span><span><i data-parcial/>{tx('tr.datos.fdLeyParcial')}</span></p>
    {(notas.length>0||id)&&<ul className="pc-notas ui-reset" role="list" aria-label={tx('tr.datos.fdNotasAria')}>{id&&<li style={{listStyle:'none'}}><b>{tx('tr.datos.fdIdentidad')}.</b> {tx('tr.datos.fdNotaIdentidad')}</li>}{notas.map(n=><li key={n.clave} style={{listStyle:'none'}}><b>{n.nombre}.</b> {n.texto}</li>)}</ul>}
    {tr.error&&<p className="ac-nota" role="status" style={{padding:'8px 14px'}}>{tx('tr.datos.fdFechasNoDisp',{err:tr.error})}</p>}
   </section>
   <div className="pc-grid" data-cols="4-4-4">
    <section className="pc-card" aria-labelledby="ci-t"><header className="pc-card-head"><div><h2 id="ci-t">{tx('tr.datos.fdCobIdTit')}</h2><p>{tx('tr.datos.fdCadaTicket')}</p></div><LinkButton href="/history" size="sm" variant="ghost" icon={<Arrow/>}>{tx('tr.datos.fdDetalle')}</LinkButton></header>
     {cargando?<Loading compact message={tx('tr.datos.fdCargandoId')}/>:!id?<p className="ac-vacio">{tx('tr.datos.fdNoEstima')}</p>:<div className="pc-fill" style={{display:'flex',flexDirection:'column',gap:10}}>
      <div style={{display:'flex',alignItems:'center',gap:14}}><ProgressRing value={id.bps/10000} size={72} stroke={8} label={fmtPct(id.bps/100)} title={tx('tr.datos.idRing',{pct:fmtPct(id.bps/100)})}/><p className="pc-s" style={{margin:0,fontSize:13}}><b style={{color:'var(--ink)',fontSize:18}}>{nf.format(id.vinculadas)}</b><br/>{tx('tr.datos.idDe',{n:nf.format(id.total)})}</p></div>
      <BarraParte etiqueta={tx('tr.datos.fdVinculadas')} valor={id.vinculadas} max={id.total} c={3} fin={nf.format(id.vinculadas)}/><BarraParte etiqueta={tx('tr.datos.fdSinId')} valor={id.sinIdentificar} max={id.total} c={4} estado="parcial" fin={nf.format(id.sinIdentificar)}/><BarraParte etiqueta={tx('tr.datos.fdPorRevisar')} valor={id.porRevisar+id.retenidas} max={id.total} c={8} estado="parcial" fin={nf.format(id.porRevisar+id.retenidas)}/></div>}
    </section>
    <section className="pc-card" aria-labelledby="cs-t" data-testid="estado-sincronizacion"><header className="pc-card-head"><div><h2 id="cs-t">{tx('tr.datos.syncTitulo')}</h2><p>{tx('tr.datos.fdSyncSub')}</p></div></header>
     {fr.busy&&!fr.data?<Loading compact message={tx('tr.datos.fdCargandoSync')}/>:!sync.disponible?<p className="ac-vacio">{fr.error||tx('tr.datos.syncManual')}</p>
      :sync.fuentes.length===0?<p className="ac-vacio">{tx('tr.datos.syncNinguna')}</p>
      :<ul className="pc-lista ui-reset pc-fill" role="list">{sync.fuentes.map(s=><li key={s.clave} style={{listStyle:'none'}}><i className="pc-punto" data-tono={TONO[s.tono as keyof typeof TONO]??'off'}/><span className="pc-grow"><span className="pc-t"><ConMarca marca={s.clave}>{s.nombre}</ConMarca></span><span className="pc-s">{s.metodo} · {s.exito}{s.siguiente?' · '+tx('tr.datos.fdSiguiente',{x:s.siguiente}):''}{s.error?' · '+s.error:''}</span></span><Estado tono={s.tono}>{s.estado}</Estado></li>)}</ul>}
    </section>
    <section className="pc-card" aria-labelledby="cc-t2"><header className="pc-card-head"><div><h2 id="cc-t2">{tx('tr.datos.fdCalcTit')}</h2><p>{tx('tr.datos.fdCalcSub')}</p></div></header>
     {fr.busy&&!fr.data?<Loading compact message={tx('tr.datos.fdCargandoCalc')}/>:sync.calculos.length?<ul className="pc-lista ui-reset pc-fill" role="list">{sync.calculos.map(c=><li key={c.clave} style={{listStyle:'none'}}><span className="pc-grow"><span className="pc-t">{c.nombre}</span><span className="pc-s">{c.actualizado??tx('tr.datos.fdSinActualizar')}{c.pendientes>0?' · '+tx('tr.datos.syncFaltan',{n:c.pendientes}):''}</span></span><span className="pc-estado" data-tono="off">{c.estado}</span></li>)}</ul>:<p className="ac-vacio">{tx('tr.datos.fdSinCalculos')}</p>}
    </section>
   </div>
  </>}
 </section>;
}
