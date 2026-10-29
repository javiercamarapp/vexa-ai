'use client';
import {useT} from '../i18n/proveedor';
import type {FugaVista} from '../../../../../packages/workspace-service/fuga-reembolsos.mjs';
import {KindBadge} from '../ui/kind-badge';
import {LinkButton,Arrow} from '../ui/button';
import {Skeleton} from './fuga-esqueleto';
import {NoDisponible} from './fuga-partes';
import {fraseConcentracion,periodoDelTitular,usd} from './fuga-modelo.mjs';
import {endpointFuga,useFuga} from './use-fuga';
import './fuga.css';

/**
 * Tarjeta/KPI exportable para el Resumen: «Fuga de reembolsos». Sin `data` consulta /api/refunds sola; con `data` solo dibuja.
 * Uso: <FugaTarjeta /> o <FugaTarjeta data={vista} />. Cifra Observada, en USD, con enlace a /refunds.
 */
export function FugaTarjeta({data,query}:{data?:FugaVista|null;query?:string}){
 const t=useT(),f=useFuga(data===undefined?endpointFuga(query):null);
 const v=data??f.data,per=v?periodoDelTitular(v):null;
 return <section className="card fg-tarjeta" aria-labelledby="fg-tarjeta-t">
  <div className="fg-tarjeta-top"><h2 id="fg-tarjeta-t">{t('fuga.titulo')}</h2></div>
  {!v&&f.busy?<Skeleton lineas={3} segundos={f.segundos} compacto/>
   :!v?<NoDisponible texto={f.error?.texto??t('tr.fuga.tarjNoDisp')} onRetry={f.reload}/>
   :v.titular.status!=='ok'?<NoDisponible texto={v.titular.status==='empty'?t('tr.fuga.tarjSinReemb'):t('tr.fuga.tarjNoCero')}/>
   :<>
    <p className="fg-big fg-big-sm">{usd(v.titular.usdBrutoMinor)}<small>{t('tr.fuga.usdDevueltos')}</small></p>
    {per&&<p className="fg-meta"><b>{per.etiqueta}</b>{per.ventanas.length>0&&<> · {per.ventanas.join(' · ')}</>}</p>}
    {per?.nota&&<p className="fg-meta" role="note">{per.nota}</p>}
    <p className="fg-meta">{t('tr.fuga.sinCancParcial',{usd:usd(v.titular.usdNetoMinor)})}</p>
    {fraseConcentracion(v)&&<p className="fg-frase">{fraseConcentracion(v)}</p>}
    <div className="fg-tarjeta-pie"><LinkButton href="/refunds" variant="ghost" size="sm" icon={<Arrow/>}>{t('tr.fuga.verDetalle')}</LinkButton><KindBadge kind="observed"/></div>
   </>}
 </section>;
}
