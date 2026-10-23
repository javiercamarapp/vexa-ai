'use client';
import {useMemo,useState} from 'react';
import {PageHeader} from '../ui/page-header';
import {FilterBar,FilterSpacer} from '../ui/filter-bar';
import {SegmentedControl} from '../ui/segmented';
import {Button,Download,LinkButton,Refresh} from '../ui/button';
import {Card} from '../ui/card';
import {KpiStrip,type Kpi} from '../ui/kpi-strip';
import {Popover} from '../ui/overlay';
import {ErrorState} from '../ui/error-state';
import {Loading} from '../ui/loading';
import {KindBadge} from '../ui/kind-badge';
import {Icon} from '../ui/icons';
import {NoDisponible} from '../refunds/fuga-partes';
import {bajar} from '../refunds/fuga-pantalla';
import {Delta,Fila,MiniPct,Vacio} from '../dinero/partes';
import {CierraBrecha,filtrarIngresos,Familias,GraficoMeses,Intensidad,PanelCanales,PanelFamilias,Puente,TresColumnas,serieVentas,variacionVentas} from './gaps-bloques';
import {EstimadorBrecha,type Supuesto} from './gaps-recs';
import {csvIngresos,csvIntensidad,csvRecomendaciones,proveniencia,resumenHtml} from './gaps-archivos.mjs';
import {NOMBRE,num} from './gaps-modelo.mjs';
import {useGaps} from './use-gaps';
import '../dinero/dinero.css';

const big=(m:string)=>Number(BigInt(m)/100n);
const corto=(n:number)=>n>=1_000_000?`$${(n/1_000_000).toFixed(2)}M`:n>=1000?`$${Math.round(n/1000)}k`:`$${n}`;

/** Pantalla «Brechas de ingreso»: titular, KPI en color, puente de ventas a ingreso retenido, dónde gano / pierdo / podría ganar, tabla «Cierra esta brecha» y ventas vs quejas. Siempre ingreso bruto, nunca margen. */
export function GapsPantalla({organization}:{organization?:string}){
 const g=useGaps(),v=g.data;
 const [per,setPer]=useState<'1'|'3'|'6'|'12'|'todo'>('todo'),[off,setOff]=useState<string[]>([]);
 const [aviso,setAviso]=useState(''),[supuesto,setSupuesto]=useState<Supuesto|null>(null);
 const irA=(id:string)=>{const el=document.getElementById('rec-'+id)??document.getElementById('gp-brecha');el?.scrollIntoView({behavior:'smooth',block:'center'});};
 const bajarArchivo=(a:{nombre:string;mime:string;contenido:string;total:number})=>{bajar(a);setAviso(`Descargado: ${a.nombre}. No se envió nada.`);};
 const ok=v?.ingresos.status==='ok'?v.ingresos:null;
 const CANAL_C:Record<string,number>={amazon:1,walmart:5,bestbuy:4,shopify:3};
 const todosCanales=ok?[...new Set(ok.meses.flatMap(m=>Object.keys(m.canales)))].sort((a,b)=>(CANAL_C[a]??8)-(CANAL_C[b]??8)):[];
 const activos=todosCanales.filter(c=>!off.includes(c));
 const filtrado=useMemo(()=>ok?filtrarIngresos(ok,per==='todo'?null:Number(per),activos):null,[ok,per,activos.join('|')]);// eslint-disable-line react-hooks/exhaustive-deps
 const r=v?.perdidas.reembolsos,c=v?.perdidas.cancelaciones,t=v?.perdidas.tracker;
 const ventas=ok&&c?.status==='ok'?big(ok.activoMinor)+big(c.canceladoMinor):null;
 const kpis:Kpi[]=v?[
  {label:'Ventas brutas',c:1,value:ok?corto(ventas??big(ok.activoMinor)):'—',spark:serieVentas(ok),note:<span className="dg-kpi-nota"><Delta p={variacionVentas(ok)} sufijo="vs mes completo previo"/></span>},
  {label:'Cancelaciones',c:2,value:c?.status==='ok'?corto(big(c.canceladoMinor)):'—',note:c?.status==='ok'?<><MiniPct c={2} p={ventas?big(c.canceladoMinor)*100/ventas:null} label="Cancelado sobre ventas brutas"/><span>{num(c.lineas)} líneas · {c.pct!==null?c.pct.toLocaleString('es-MX',{maximumFractionDigits:1})+' % de las líneas':'sin dato'}</span></>:'No disponible ahora'},
  {label:'Reembolsos',c:2,value:r?.status==='ok'?corto(big(r.brutoMinor)):'—',note:r?.status==='ok'?<><MiniPct c={2} p={ok?big(r.activoMinor)*100/Math.max(1,big(ok.activoMinor)):null} label="Reembolsos sobre ingreso"/><span>{num(r.n)} reembolsos{r.sinMonto>0?` · ${num(r.sinMonto)} sin monto`:''}</span></>:'No disponible ahora'},
  {label:'No recuperado (Tracker)',c:4,value:t?.status==='ok'?corto(big(t.negadosMinor)):'—',note:t?.status==='ok'?<><MiniPct c={4} p={t.total?t.negados*100/t.total:null} label="Solicitudes negadas o vencidas"/><span>{num(t.negados)} de {num(t.total)} solicitudes · muestra</span></>:'Sin Tracker cargado'},
 ]:[];
 const titular=v&&ok&&r?.status==='ok'&&ventas?`De ${corto(ventas)} vendidos, ${corto(Math.max(0,big(ok.activoMinor)-big(r.activoMinor)))} se quedan tras cancelaciones y reembolsos; el dinero devuelto pesa ${(big(r.activoMinor)*100/Math.max(1,big(ok.activoMinor))).toLocaleString('es-MX',{maximumFractionDigits:1})} % del ingreso.`:null;
 const exportar=v&&<Popover label="Exportar archivos" align="end" width={260} triggerClassName="btn btn-secondary" trigger={<><Download/><span className="btn-label">Exportar</span></>}>
  <ul className="ui-reset" style={{listStyle:'none',margin:0,padding:4,display:'grid',gap:4}}>
   <li><Button size="sm" icon={<Download/>} disabled={!ok} onClick={()=>bajarArchivo(resumenHtml(v))}>Resumen (HTML)</Button></li>
   <li><Button size="sm" icon={<Download/>} disabled={v.ranking.status!=='ok'} onClick={()=>bajarArchivo(csvIngresos(v))}>Ingreso por SKU (CSV)</Button></li>
   <li><Button size="sm" icon={<Download/>} disabled={v.intensidad.status!=='ok'} onClick={()=>bajarArchivo(csvIntensidad(v))}>Intensidad (CSV)</Button></li>
   <li><Button size="sm" icon={<Download/>} disabled={v.recomendaciones.items.length===0} onClick={()=>bajarArchivo(csvRecomendaciones(v))}>Recomendaciones (CSV)</Button></li></ul></Popover>;
 return <div className="dg-page">
  <PageHeader eyebrow={'Dinero'+(organization?' · datos sintéticos de demostración':'')} title="Brechas de ingreso" description="Dónde ganas, dónde pierdes y por qué. Siempre ingreso bruto: no hay costo ni margen por producto."
   actions={<><LinkButton href="/refunds" variant="secondary">Ver fuga de reembolsos</LinkButton>{exportar}<Button icon={<Refresh/>} onClick={()=>g.reload()} loading={g.busy&&!!v}>Actualizar</Button></>}/>
  {!v&&g.busy&&<Card><Loading message={g.segundos<8?'Calculando brechas…':`Calculando… ${g.segundos} s. Está tardando más de lo normal.`}/></Card>}
  {!v&&!g.busy&&g.error&&<Card><ErrorState title={g.error.code==='acceso'?'Tu rol no tiene acceso a este panel':'No disponible ahora'} body={g.error.texto} onRetry={g.error.code==='acceso'?undefined:()=>g.reload()}/></Card>}
  {v&&<>
   {titular&&<p className="dg-titular">{titular}</p>}
   <KpiStrip items={kpis} label="Indicadores de brechas de ingreso"/>
   {ok&&todosCanales.length>0&&<FilterBar label="Filtros de ingreso por mes y canal">
    <SegmentedControl size="sm" label="Periodo" value={per} onChange={setPer} options={[{value:'1',label:'1 mes'},{value:'3',label:'3 meses'},{value:'6',label:'6 meses'},{value:'12',label:'12 meses'},{value:'todo',label:'Todo'}]}/>
    {todosCanales.map(c=>{const on=!off.includes(c);return <button key={c} type="button" className="dg-fchip ui-reset" aria-pressed={on} style={{['--cat' as string]:`var(--chart-${CANAL_C[c]??8})`}} onClick={()=>setOff(on?(activos.length>1?[...off,c]:off):off.filter(x=>x!==c))}>{NOMBRE[c]??c}</button>;})}
    <FilterSpacer/><span className="dg-sello">Aplica a la gráfica mensual y a «Por canal»</span>
   </FilterBar>}
   <Fila split="8-4">
    <Card title="Ingreso bruto por mes y canal" description="Un color por canal; lo parcial lleva trama" actions={<KindBadge kind="observed"/>}>
     {v.ingresos.status==='unavailable'?<NoDisponible onRetry={()=>g.reload()}/>:!ok?<Vacio>Todavía no hay pedidos en el libro. Carga el export de Amazon o Walmart.</Vacio>:<GraficoMeses ing={filtrado??ok}/>}</Card>
    <Card title="Por canal" description="Ingreso bruto, sin cancelados" actions={<KindBadge kind="observed"/>}>{ok?<PanelCanales ing={filtrado??ok}/>:<Vacio>Sin canales con pedidos.</Vacio>}</Card>
   </Fila>
   <Fila split="6-6">
    <Card title="Puente: de ventas a ingreso retenido" description="Cancelaciones y reembolsos restados de las ventas brutas" actions={<KindBadge kind="inferred"/>}><Puente v={v}/></Card>
    <Card title="Intensidad de reembolso por SKU y canal" description="Los pares con más devolución por cada peso vendido" actions={<KindBadge kind="observed"/>}><Intensidad v={v} onReintentar={()=>g.reload()}/></Card>
   </Fila>
   <TresColumnas v={v} onReintentar={()=>g.reload()} irA={irA}/>
   <Card id="gp-brecha" title="Cierra esta brecha" description="Reglas sin IA sobre datos observados; cada una dice qué hacer, por qué y cuánto ingreso está en juego" actions={<KindBadge kind="inferred"/>}><CierraBrecha v={v} onReintentar={()=>g.reload()} supuesto={supuesto}/></Card>
   <Fila split="8-4">
    <Card title="Ventas vs quejas por familia de producto" description="Ingreso (azul) frente a conversaciones de soporte por cada 100 líneas (violeta)" actions={<KindBadge kind="observed"/>}><Familias v={v} onReintentar={()=>g.reload()}/></Card>
    <Card title="Cobertura del análisis" description="Qué parte del histórico se puede cruzar"><PanelFamilias v={v}/></Card>
   </Fila>
   <Fila split="6-6">
    <Card title="¿Cuánto podrías recuperar?" description="Estimador con candado: tú tecleas los supuestos" actions={<KindBadge kind="estimated"/>}><EstimadorBrecha recs={v.recomendaciones.items} onSupuestos={setSupuesto}/></Card>
    <Card title="Cómo se calculó" description={`Consulta del ${v.generatedAt.slice(0,10)}`}>
     <ul style={{margin:0,paddingLeft:18,fontSize:13,lineHeight:1.55,color:'var(--ui-secondary)'}}>
      {proveniencia(v).map((x,i)=><li key={i}>{x}</li>)}
      <li>Mes completo: empieza el día 1 a 3, termina a menos de 3 días de su fin y no cae a menos de la mitad del mes previo. Solo los completos entran a comparaciones.</li>
      <li>Lo que no se puede calcular hoy: margen o utilidad, tasa por cohorte, unidades, causa raíz, geografía.</li></ul>
     <p className="dg-nota" role="status" aria-live="polite"><Icon name="info" size={12}/> {aviso||'Los archivos se generan en tu navegador; no se envía nada.'}</p></Card>
   </Fila>
  </>}
 </div>;
}
