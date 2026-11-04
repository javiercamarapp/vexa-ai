'use client';
import {useMemo} from 'react';
import type {CoberturaPedidosCruda} from '../../../../../packages/workspace-service/pedidos-cobertura.mjs';
import {modeloPedidos,nombreRetailer,textoCobertura,textoPeriodo,type GrupoPedidos} from '../../lib/legibilidad/pedidos.mjs';
import {DataTable} from '../ui/data-table';
import {EmptyState} from '../ui/empty-state';
import {ErrorState} from '../ui/error-state';
import {useJson} from '../ui/use-json';
import {nf} from '../ui/format';
import {fechaCorta} from '../../lib/formato/idioma.mjs';
import {useT,useIdioma} from '../i18n/proveedor';
import '../panel-comun/panel-comun.css';

const accept=(j:unknown)=>{const d=(j as {data?:CoberturaPedidosCruda})?.data;return d&&'enlaces' in d&&'devoluciones' in d&&typeof d.lectura==='object'&&d.lectura!==null?d:null;};
/** Una cifra no leída (null) se dice «—», nunca 0. */
const cifra=(v:number|null|undefined)=>v==null?'—':nf.format(v);

/** «Pedidos, envíos y devoluciones»: unión por ID de pedido + retailer. Los envíos de Speedship son garantía, así que la unión nunca es un % de ventas; sin base de cálculo se dice n/d. */
export function PedidosCobertura(){
 return <PedidosVista r={useJson<CoberturaPedidosCruda>('/api/coverage/pedidos',accept)}/>;
}
/** Parte visual sin red: recibe el estado de la lectura (la prueba le pasa resultados sintéticos). */
export function PedidosVista({r}:{r:{data:CoberturaPedidosCruda|null;busy:boolean;error:string|null|undefined;reload:()=>void}}){
 const tx=useT(),idioma=useIdioma();
 const m=useMemo(()=>modeloPedidos(r.data),[r.data]);
 const cargando=r.busy&&!r.data,nombre=(g:GrupoPedidos)=>nombreRetailer(g.clave,tx);
 const periodo=(p:{desde:string;hasta:string}|null)=>p?textoPeriodo(p.desde,p.hasta,idioma)??tx('tr.datos.pedSinPeriodo'):tx('tr.datos.pedSinPeriodo');
 const conEnvios=m.grupos.filter(g=>g.envios||g.pedidos!=null),conDevs=m.grupos.filter(g=>g.devoluciones);
 const sinEnvios=r.data&&r.data.enlaces===null,sinDevs=r.data&&r.data.devoluciones===null;
 const lec=r.data?.lectura,sinResumenTodo=lec?.enlaces==='sin_resumen'&&lec?.devoluciones==='sin_resumen';
 // «Resumen al <fecha>»: cuándo se calculó cada parte. Si la fecha no se puede leer, no se inventa.
 const alFecha=(iso:string|null|undefined)=>{const f=iso?fechaCorta(iso,idioma):null;return f?<p className="ac-nota" style={{padding:'4px 14px'}}>{tx('tr.datos.pedResumenAl',{fecha:f})}</p>:null;};
 return <section className="pc-card" data-flush aria-labelledby="pd-t" data-testid="pedidos-cobertura">
  <header className="pc-card-head"><div><h2 id="pd-t">{tx('tr.datos.pedTitulo')}</h2><p>{tx('tr.datos.pedSub')}</p></div></header>
  {r.error&&!r.data?<ErrorState title={tx('hoy.noDisponible')} body={r.error} onRetry={()=>r.reload()} compact/>
   :cargando?<DataTable caption={tx('tr.datos.pedTitulo')} state="loading" rowKey={(g:GrupoPedidos)=>g.clave} rows={[] as GrupoPedidos[]} columns={[]}/>
   :sinResumenTodo?<p className="ac-vacio" role="status">{tx('tr.datos.pedSinResumen')}</p>
   :m.estado==='no_disponible'?<p className="ac-vacio" role="status">{tx('tr.datos.pedNoDisp')}</p>
   :m.estado==='vacio'?<EmptyState compact art="inbox" title={tx('tr.datos.pedVacio')} body={tx('tr.datos.pedVacioCuerpo')}/>
   :<>
    {conEnvios.length>0&&<DataTable caption={tx('tr.datos.pedEnviosTit')} rowKey={g=>g.clave} rows={conEnvios} maxHeight="none" columns={[
     {key:'r',header:tx('tr.datos.pedHRetailer'),render:g=>nombre(g)},
     {key:'p',header:tx('tr.datos.pedHPedidos'),align:'num',render:g=>cifra(g.pedidos)},
     {key:'e',header:tx('tr.datos.pedHEnvios'),align:'num',render:g=>cifra(g.envios?.total)},
     {key:'s',header:tx('tr.datos.pedHSinId'),align:'num',render:g=>cifra(g.envios?.sinId)},
     {key:'u',header:tx('tr.datos.pedHUnion'),align:'num',render:g=>g.envios?textoCobertura(g.envios.cobertura,idioma):'—'},
     {key:'h',header:tx('tr.datos.pedHPeriodo'),render:g=>g.envios?(r.data?.periodoEnvios==null?'—':periodo(g.envios.periodo)):'—'}]}/>}
    {conEnvios.length>0&&alFecha(r.data?.refreshedAt?.enlaces)}
    {sinEnvios&&<p className="ac-nota" role="status" style={{padding:'8px 14px'}}>{tx(lec?.enlaces==='sin_resumen'?'tr.datos.pedSinResumenEnv':'tr.datos.pedParcialEnv')}</p>}
    {conDevs.length>0&&<DataTable caption={tx('tr.datos.pedDevTit')} rowKey={g=>g.clave} rows={conDevs} maxHeight="none" columns={[
     {key:'r',header:tx('tr.datos.pedHRetailer'),render:g=>nombre(g)},
     {key:'d',header:tx('tr.datos.pedHDevs'),align:'num',render:g=>cifra(g.devoluciones?.total)},
     {key:'s',header:tx('tr.datos.pedHSinId'),align:'num',render:g=>cifra(g.devoluciones?.sinId)},
     {key:'p',header:tx('tr.datos.pedHConPedido'),align:'num',render:g=>textoCobertura(g.devoluciones?.coberturaPedido,idioma)},
     {key:'e',header:tx('tr.datos.pedHConEnvio'),align:'num',render:g=>textoCobertura(g.devoluciones?.coberturaEnvio,idioma)},
     {key:'h',header:tx('tr.datos.pedHPeriodo'),render:g=>periodo(g.devoluciones?.periodo??null)}]}/>}
    {conDevs.length>0&&alFecha(r.data?.refreshedAt?.devoluciones)}
    {sinDevs&&<p className="ac-nota" role="status" style={{padding:'8px 14px'}}>{tx(lec?.devoluciones==='sin_resumen'?'tr.datos.pedSinResumenDev':'tr.datos.pedParcialDev')}</p>}
    <ul className="pc-notas ui-reset" role="list" aria-label={tx('tr.datos.fdNotasAria')}>
     <li style={{listStyle:'none'}}>{tx('tr.datos.pedNotaLlave')}</li><li style={{listStyle:'none'}}>{tx('tr.datos.pedNotaGarantia')}</li><li style={{listStyle:'none'}}>{tx('tr.datos.pedNotaNd')}</li></ul>
   </>}
 </section>;
}
