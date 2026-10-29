'use client';
import {useT,useIdioma} from '../i18n/proveedor';
import {fecha} from '../../lib/i18n/formato';
import {useMemo,useState} from 'react';
import type {PainVista,PuntoPP} from '../../../../../packages/workspace-service/pain-points.d.mts';
import {RovaqCargando} from '../rovaq-cargando';
import {PageHeader} from '../ui/page-header';
import {Download,LinkButton} from '../ui/button';
import {Card} from '../ui/card';
import {KpiStrip,type Kpi} from '../ui/kpi-strip';
import {KindBadge} from '../ui/kind-badge';
import {Notice} from '../ui/notice';
import {ErrorState} from '../ui/error-state';
import {FilterBar,FilterSpacer} from '../ui/filter-bar';
import {SegmentedControl} from '../ui/segmented';
import {MenuList,Popover} from '../ui/overlay';
import {useJson} from '../ui/use-json';
import {Fila} from '../dinero/partes';
import {Burbujas} from './burbujas';
import {Detalle} from './detalle';
import {mayores} from './burbujas-modelo.mjs';
import {CLASE_KIND,kpisDe,num,valorMostrado} from './modelo.mjs';
import '../dinero/dinero.css';
import './pain-points.css';

const acepta=(j:unknown)=>{const d=(j as {data?:PainVista})?.data;return d&&typeof d==='object'&&Array.isArray(d.puntos)&&Array.isArray(d.temas)?d:null;};
/** Pantalla «Puntos de dolor» (/pain-points): mapa de burbujas por tema (tamaño = dinero o volumen), tabla de los 8 mayores siempre visible y drawer con evidencia hasta la fila. */
export function PainPointsPantalla({organization}:{organization?:string}){
 const t=useT(),idioma=useIdioma(),f=useJson<PainVista>('/api/pain-points',acepta);
 const [modo,setModo]=useState<'dinero'|'volumen'>('dinero'),[tema,setTema]=useState<string>('todos'),[sel,setSel]=useState<string|null>(null);
 const v=f.data;
 const visibles=useMemo(()=>tema==='todos'?null:new Set([tema]),[tema]);
 const filtrados=useMemo(()=>v?v.puntos.filter(p=>!visibles||visibles.has(p.tema)):[],[v,visibles]);
 const top=useMemo(()=>mayores(filtrados,modo,8),[filtrados,modo]);
 const punto=v&&sel?v.puntos.find(p=>p.id===sel)??null:null;
 if(!v&&f.busy)return <RovaqCargando mensaje=""/>;
 const temaDe=(id:string)=>v!.temas.find(t=>t.id===id)!;
 const caidas=v?Object.entries(v.partes).filter(([,e])=>e==='unavailable').length:0;
 const kpis:Kpi[]=v?kpisDe(v,idioma).map(k=>({key:k.key,c:k.c,label:k.label,value:k.valor,note:k.nota})):[];
 const exportables=v?.puntos.filter(p=>p.evidencia.disponible&&!p.agregado)??[];
 const acciones=v&&exportables.length>0&&<Popover label={t('pp.exportarEvidencia')} align="end" width={300} triggerClassName="btn btn-secondary" trigger={<><Download/><span className="btn-label">{t('pp.exportar')}</span></>}>
  <MenuList label={t('pp.csvPorPunto')}>{exportables.map(p=><li key={p.id}><LinkButton size="sm" icon={<Download/>} href={'/api/pain-points/'+encodeURIComponent(p.id)+'/evidence?format=csv'} download="">{p.nombre}</LinkButton></li>)}</MenuList></Popover>;
 return <div className="dg-page pp-page">
  <PageHeader eyebrow={t('pp.eyebrow')+(organization?t('pp.sinteticos'):'')} title={t('pp.titulo')} description={t('pp.descLarga')} actions={acciones||undefined}/>
  {!v&&f.error&&<Card><ErrorState title={t('pp.errorTitulo')} body={f.status===403?t('pp.errorRol'):f.error} onRetry={f.status===403?undefined:()=>f.reload()}/></Card>}
  {v&&<>
   {caidas>0&&<Notice tone="warn" title={t('pp.parcialTitulo')}>{t('pp.parcialCuerpo')}</Notice>}
   <FilterBar label={t('pp.filtros')}><SegmentedControl size="sm" label={t('pp.tema')} value={tema} onChange={setTema} options={[{value:'todos',label:t('pp.todos')},...v.temas.map(t=>({value:t.id,label:t.nombre}))]}/><FilterSpacer/><span className="pp-corte">{t('pp.corte',{fecha:fecha(idioma,v.generatedAt,{day:'numeric',month:'short'})})}</span></FilterBar>
   <KpiStrip items={kpis} label={t('pp.indicadores')}/>
   <Fila split="8-4">
    <Card title={t('pp.mapa')} description={t('pp.mapaDesc')} actions={<><SegmentedControl size="sm" label={t('pp.medida')} value={modo} onChange={setModo} options={[{value:'dinero',label:t('pp.dinero')},{value:'volumen',label:t('pp.volumen')}]}/><KindBadge kind="observed"/></>}>
     <Burbujas vista={v} modo={modo} seleccion={sel} onElegir={setSel} visibles={visibles}/>
    </Card>
    <Card title={t('pp.top8')} description={modo==='dinero'?t('pp.top8Dinero'):t('pp.top8Volumen')} actions={<KindBadge kind="observed"/>}>
     <div className="pp-tabla-wrap"><table className="pp-tabla"><caption className="sr-only">{t('pp.tablaCaption')}</caption>
      <thead><tr><th scope="col">{t('pp.colPunto')}</th><th scope="col" data-num>{modo==='dinero'?t('pp.colUsd'):t('pp.colVolumen')}</th><th scope="col">{t('pp.colClase')}</th></tr></thead>
      <tbody>{top.map(p=><tr key={p.id} data-sel={sel===p.id||undefined}><td><i className="pp-punto" style={{background:`var(--chart-${temaDe(p.tema).c})`}} aria-hidden="true"/><button type="button" className="row-link-inline" title={temaDe(p.tema).nombre} onClick={()=>setSel(p.id)}>{p.nombre}</button></td><td data-num>{valorMostrado(p,modo,idioma)}</td><td><KindBadge kind={CLASE_KIND[p.clase]}/></td></tr>)}
       {top.length===0&&<tr><td colSpan={3} className="pp-nota">{t('pp.sinPuntos')}</td></tr>}</tbody></table></div>
     <p className="pp-nota">{t('pp.mostrando',{n:top.length,total:filtrados.filter(p=>!p.agregado).length})}</p>
    </Card>
   </Fila>
   <Card title={t('pp.noSeSabe')} description={t('pp.noSeSabeDesc')}>
    <ul className="pp-lista pp-lista-cols">{v.puntos.filter(p=>p.dinero.sinDato&&!p.agregado&&p.dinero.causa!=='no_aplica').map(p=><li key={p.id}><button type="button" className="row-link-inline" onClick={()=>setSel(p.id)}>{p.nombre}</button>: {p.dinero.sinDato?p.dinero.motivo:''}</li>)}</ul>
   </Card>
   <p className="pp-nota">{v.nota} {t('pp.resumenPuntos',{n:num(v.puntos.length),temas:v.temas.length})}</p>
  </>}
  {v&&<Detalle punto={punto} vista={v} onCerrar={()=>setSel(null)}/>}
 </div>;
}
export type {PuntoPP};
