'use client';
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
import {disponerBurbujas,mayores} from './burbujas-modelo.mjs';
import {CLASE_KIND,kpisDe,num,valorMostrado} from './modelo.mjs';
import '../dinero/dinero.css';
import './pain-points.css';

const acepta=(j:unknown)=>{const d=(j as {data?:PainVista})?.data;return d&&typeof d==='object'&&Array.isArray(d.puntos)&&Array.isArray(d.temas)?d:null;};
/** Pantalla «Puntos de dolor» (/pain-points): mapa de burbujas por tema (tamaño = dinero o volumen), tabla de los 8 mayores siempre visible y drawer con evidencia hasta la fila. */
export function PainPointsPantalla({organization}:{organization?:string}){
 const f=useJson<PainVista>('/api/pain-points',acepta);
 const [modo,setModo]=useState<'dinero'|'volumen'>('dinero'),[tema,setTema]=useState<string>('todos'),[sel,setSel]=useState<string|null>(null);
 const v=f.data;
 const visibles=useMemo(()=>tema==='todos'?null:new Set([tema]),[tema]);
 const filtrados=useMemo(()=>v?v.puntos.filter(p=>!visibles||visibles.has(p.tema)):[],[v,visibles]);
 const top=useMemo(()=>mayores(filtrados,modo,8),[filtrados,modo]);
 const sinCifra=useMemo(()=>v?disponerBurbujas({puntos:filtrados,modo,ancho:840}).sinCifra:[],[v,filtrados,modo]);
 const punto=v&&sel?v.puntos.find(p=>p.id===sel)??null:null;
 if(!v&&f.busy)return <RovaqCargando mensaje=""/>;
 const temaDe=(id:string)=>v!.temas.find(t=>t.id===id)!;
 const caidas=v?Object.entries(v.partes).filter(([,e])=>e==='unavailable').length:0;
 const kpis:Kpi[]=v?kpisDe(v).map(k=>({key:k.key,c:k.c,label:k.label,value:k.valor,note:k.nota})):[];
 const exportables=v?.puntos.filter(p=>p.evidencia.disponible&&!p.agregado)??[];
 const acciones=v&&exportables.length>0&&<Popover label="Exportar evidencia" align="end" width={300} triggerClassName="btn btn-secondary" trigger={<><Download/><span className="btn-label">Exportar</span></>}>
  <MenuList label="CSV por punto de dolor">{exportables.map(p=><li key={p.id}><LinkButton size="sm" icon={<Download/>} href={'/api/pain-points/'+encodeURIComponent(p.id)+'/evidence?format=csv'} download="">{p.nombre}</LinkButton></li>)}</MenuList></Popover>;
 return <div className="dg-page pp-page">
  <PageHeader eyebrow={'Insights'+(organization?' · datos sintéticos de demostración':'')} title="Puntos de dolor" description="Dónde se pierde dinero y por qué, con evidencia hasta la fila. Tamaño = dinero devuelto en USD bruto; lo que no se sabe dice «Sin dato», nunca 0." actions={acciones||undefined}/>
  {!v&&f.error&&<Card><ErrorState title="No se pudo calcular los puntos de dolor" body={f.status===403?'Tu rol no tiene acceso a este panel. Lo ven propietarios y analistas.':f.error} onRetry={f.status===403?undefined:()=>f.reload()}/></Card>}
  {v&&<>
   {caidas>0&&<Notice tone="warn" title="Datos parciales">Una parte de las fuentes no respondió a tiempo: sus puntos salen como «No disponible ahora», no como cero. Se reintenta sola.</Notice>}
   <FilterBar label="Filtros de puntos de dolor"><SegmentedControl size="sm" label="Tema" value={tema} onChange={setTema} options={[{value:'todos',label:'Todos'},...v.temas.map(t=>({value:t.id,label:t.nombre}))]}/><FilterSpacer/><span className="pp-corte">Corte {new Date(v.generatedAt).toLocaleDateString('es-MX',{day:'numeric',month:'short'})}</span></FilterBar>
   <KpiStrip items={kpis} label="Indicadores de puntos de dolor"/>
   <Fila split="8-4">
    <Card title="Mapa de burbujas" description="Un cúmulo por tema · el tamaño es el área" actions={<><SegmentedControl size="sm" label="Medida del tamaño" value={modo} onChange={setModo} options={[{value:'dinero',label:'Dinero'},{value:'volumen',label:'Volumen'}]}/><KindBadge kind="observed"/></>}>
     <Burbujas vista={v} modo={modo} seleccion={sel} onElegir={setSel} visibles={visibles}/>
     {sinCifra.length>0&&<p className="pp-sin" aria-label="Puntos sin cifra"><b>{sinCifra.length} sin cifra en esta medida (no es 0):</b> {sinCifra.map((p,i)=><span key={p.id}>{i>0?' · ':' '}<button type="button" className="row-link-inline" onClick={()=>setSel(p.id)}>{p.nombre}</button></span>)}</p>}
    </Card>
    <Card title="Los 8 mayores" description={modo==='dinero'?'USD bruto, de mayor a menor':'Volumen, de mayor a menor'} actions={<KindBadge kind="observed"/>}>
     <div className="pp-tabla-wrap"><table className="pp-tabla"><caption className="sr-only">Los 8 puntos de dolor mayores. Es la misma información del mapa.</caption>
      <thead><tr><th scope="col">Punto</th><th scope="col" data-num>{modo==='dinero'?'USD':'Volumen'}</th><th scope="col">Clase</th></tr></thead>
      <tbody>{top.map(p=><tr key={p.id} data-sel={sel===p.id||undefined}><td><i className="pp-punto" style={{background:`var(--chart-${temaDe(p.tema).c})`}} aria-hidden="true"/><button type="button" className="row-link-inline" title={temaDe(p.tema).nombre} onClick={()=>setSel(p.id)}>{p.nombre}</button></td><td data-num>{valorMostrado(p,modo)}</td><td><KindBadge kind={CLASE_KIND[p.clase]}/></td></tr>)}
       {top.length===0&&<tr><td colSpan={3} className="pp-nota">Sin puntos con cifra en este filtro.</td></tr>}</tbody></table></div>
     <p className="pp-nota">Mostrando {top.length} de {filtrados.filter(p=>!p.agregado).length} puntos. Cada fila abre su evidencia.</p>
    </Card>
   </Fila>
   <Card title="Qué no se sabe" description="Honestidad antes que cifras bonitas">
    <ul className="pp-lista pp-lista-cols">{v.puntos.filter(p=>p.dinero.sinDato&&!p.agregado&&p.dinero.causa!=='no_aplica').map(p=><li key={p.id}><button type="button" className="row-link-inline" onClick={()=>setSel(p.id)}>{p.nombre}</button>: {p.dinero.sinDato?p.dinero.motivo:''}</li>)}</ul>
   </Card>
   <p className="pp-nota">{v.nota} {num(v.puntos.length)} puntos · {v.temas.length} temas</p>
  </>}
  {v&&<Detalle punto={punto} vista={v} onCerrar={()=>setSel(null)}/>}
 </div>;
}
export type {PuntoPP};
