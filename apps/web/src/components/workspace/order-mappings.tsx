'use client';
import {useAutoRefresh} from '../ui/use-auto-refresh';
import {useLayoutEffect,useCallback,useEffect,useRef,useState} from 'react';
import {formatMinorUnits} from '../../lib/formato/dinero-pantalla.mjs';
import {useLocaleIntl,useT} from '../i18n/proveedor';
import type {Clave} from '../../lib/i18n';
type Order={ledgerRowId:string;entityId:string;externalId:string;currency:string;exponent:number;amountMinor:string|null;sourceName:string};
type Mapping={id:string;ledgerRowId:string;version:number;skus:string[]|null;source:string|null;active:boolean;valid:boolean;report:string|null};
type Summary={classifiableOrders:number;ordersWithDecision:number;activeDecisions:number};
type View={orders:Order[];mappings:Mapping[];recentMappings?:(Mapping&{externalId:string|null})[];canWrite:boolean;nextCursor?:string|null;summary?:Summary};
export function OrderMappings(){
 const tx=useT(),loc=useLocaleIntl(),em=(m:string)=>m.startsWith('tr.ws.')?tx(m as Clave):m;
 const [view,setView]=useState<View|null>(null),[loaded,setLoaded]=useState(false),[q,setQ]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[rowId,setRowId]=useState(''),[skuKnown,setSkuKnown]=useState(false),[skuText,setSkuText]=useState(''),[source,setSource]=useState(''),[active,setActive]=useState(true),[report,setReport]=useState(''),[consent,setConsent]=useState('');
 const generation=useRef(0),controller=useRef<AbortController|null>(null);
 const request=useCallback(async(body?:unknown,search='',cursor='')=>{
  controller.current?.abort();const abort=new AbortController();controller.current=abort;const epoch=++generation.current;setBusy(true);setError('');setNotice('');
  try{const qs=new URLSearchParams({limit:'50',...(search?{q:search}:{}),...(cursor?{cursor}:{})}).toString();const response=await fetch('/api/workspace/mappings'+(body?'':'?'+qs),{method:body?'POST':'GET',cache:'no-store',signal:abort.signal,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});if(abort.signal.aborted||epoch!==generation.current)return;
   if(!response.ok)throw Error(response.status===401||response.status===403?'tr.ws.omE401':response.status===409?'tr.ws.e409':response.status===504?'tr.ws.e504':'tr.ws.omELeer');
   let json=await response.json();if(abort.signal.aborted||epoch!==generation.current)return;
   if(body){setConsent('');const fresh=await fetch('/api/workspace/mappings?limit=50'+(search?'&q='+encodeURIComponent(search):''),{cache:'no-store',signal:abort.signal});if(abort.signal.aborted||epoch!==generation.current)return;if(!fresh.ok)throw Error('tr.ws.omEFalta');json=await fresh.json();}
   if(abort.signal.aborted||epoch!==generation.current)return;const data=json.data as View;if(!data||!Array.isArray(data.orders)||!Array.isArray(data.mappings))throw Error('tr.ws.omEVerif');setView(data);setLoaded(true);if(body)setNotice('tr.ws.omGuardada');
  }catch(e){if(!abort.signal.aborted&&epoch===generation.current){setView(null);setConsent('');setError(e instanceof Error?e.message:'tr.ws.eSolicitud');}}
  finally{if(!abort.signal.aborted&&epoch===generation.current)setBusy(false);}
 },[]);
 const invalidate=useCallback(()=>{controller.current?.abort();generation.current++;},[]);
 useEffect(()=>()=>{invalidate();},[invalidate]);
 const selected=view?.orders.find(x=>x.ledgerRowId===rowId),mapping=view?.mappings.filter(x=>x.ledgerRowId===rowId).sort((a,b)=>b.version-a.version)[0];
 const skus=skuKnown?[...new Set(skuText.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))].sort():null;
 const body={ledgerRowId:rowId,expectedVersion:mapping?.version??0,skus,source:source||null,active,report,attested:true},token=JSON.stringify(body);
 const select=(id:string)=>{const prior=view?.mappings.filter(x=>x.ledgerRowId===id).sort((a,b)=>b.version-a.version)[0];setRowId(id);setSkuKnown(prior?.skus!==null&&prior?.skus!==undefined);setSkuText(prior?.skus?.join('\n')??'');setSource(prior?.source??'');setActive(prior?.active??true);setReport('');setConsent('');setNotice('');};
 // Datos nuevos: relectura en segundo plano de la primera página con la búsqueda actual; conserva lo pintado y no corre durante una operación.
 const busyRef=useRef(true),qRef=useRef('');useLayoutEffect(()=>{busyRef.current=busy;qRef.current=q;});
 useAutoRefresh(async()=>{if(busyRef.current)return;const epoch=generation.current;const r=await fetch('/api/workspace/mappings?limit=50'+(qRef.current.trim()?'&q='+encodeURIComponent(qRef.current.trim()):''),{cache:'no-store'});if(!r.ok)return;const j=await r.json();const d=j?.data as View;if(epoch===generation.current&&!busyRef.current&&d&&Array.isArray(d.orders)&&Array.isArray(d.mappings))setView(d);},{ocupado:()=>busyRef.current});
 return <section aria-label={tx('tr.ws.omTitulo')}><h2>{tx('tr.ws.omTitulo')}</h2><p>{tx('tr.ws.omIntro')}</p>
  {view?.summary&&<p>{tx('tr.ws.omResumen',{a:view.summary.classifiableOrders.toLocaleString(loc),b:view.summary.ordersWithDecision,c:view.summary.activeDecisions})}</p>}<form onSubmit={e=>{e.preventDefault();void request(undefined,q.trim());}}><label>{tx('tr.ws.omBuscarOrden')}<input value={q} maxLength={100} onChange={e=>setQ(e.target.value)}/></label> <button disabled={busy}>{loaded?tx('tr.ws.buscar'):tx('tr.ws.omCargar')}</button></form>{busy&&<p role="status" className="sr-only">{tx('tr.ws.omVerificando')}</p>}{error&&<p role="status">{em(error)} <button type="button" disabled={busy} onClick={()=>void request(undefined,q.trim())}>{tx('hoy.reintentar')}</button></p>}{notice&&<p role="status">{em(notice)}</p>}
  {view&&<>{!view.orders.length&&<p>{tx('tr.ws.omSinOrdenes')}</p>}{view.canWrite&&<form className="action-form" onSubmit={e=>{e.preventDefault();if(selected&&consent===token)void request(body);}}>
   <label>{tx('tr.ws.omOrdenClas')}<select required value={rowId} onChange={e=>select(e.target.value)}><option value="">{tx('tr.ws.omSelOrden')}</option>{view.orders.map(o=><option key={o.ledgerRowId} value={o.ledgerRowId}>{o.externalId} · {formatMinorUnits(o.amountMinor,o.currency,o.exponent)} · {o.sourceName}</option>)}</select></label>
   {selected&&<p>{tx('tr.ws.omRevision',{v:mapping?.version??0,nota:mapping&&!mapping.valid?tx('tr.ws.omYaNoAut'):''})}</p>}
   <label><input type="checkbox" checked={skuKnown} onChange={e=>setSkuKnown(e.target.checked)}/>{tx('tr.ws.omConozco')}</label>
   {skuKnown&&<label>{tx('tr.ws.omSkuLinea')}<textarea value={skuText} onChange={e=>setSkuText(e.target.value)} rows={3}/><small>{tx('tr.ws.omListaVacia')}</small></label>}
   <label>{tx('tr.ws.omOrigen')}<select value={source} onChange={e=>setSource(e.target.value)}><option value="">{tx('exp.desconocido')}</option><option value="hubspot">HubSpot</option><option value="zendesk">Zendesk</option><option value="csv">CSV</option><option value="excel">Excel</option></select></label>
   <label><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>{tx('tr.ws.omVigente')}</label>
   <label>{tx('tr.ws.omRazon')}<textarea required minLength={20} maxLength={4000} value={report} onChange={e=>setReport(e.target.value)}/></label>
   <label><input type="checkbox" checked={consent===token} onChange={e=>setConsent(e.target.checked?token:'')}/>{tx('tr.ws.omConfirmo')}</label>
   <button disabled={busy||!selected||consent!==token}>{tx('tr.ws.omGuardar')}</button>
  </form>}{!view.canWrite&&<p>{tx('tr.ws.omRequiere')}</p>}
  {view.nextCursor&&<button type="button" disabled={busy} onClick={()=>void request(undefined,q.trim(),view.nextCursor!)}>{tx('tr.ws.omSiguientes',{n:50})}</button>}<h3>{tx('tr.ws.omUltimas')}</h3><ul>{(view.recentMappings??view.mappings).map(m=><li key={m.id}>{tx('tr.ws.omFila',{orden:((m as {externalId?:string|null}).externalId)||view.orders.find(o=>o.ledgerRowId===m.ledgerRowId)?.externalId||m.ledgerRowId,v:m.version,estado:m.valid&&m.active?tx('tr.ws.vigente'):tx('tr.ws.noVigente'),skus:m.skus===null?tx('tr.ws.omSkusDesc'):m.skus.join(', ')||tx('tr.ws.omSinSku'),origen:m.source??tx('exp.desconocido')})}</li>)}</ul></>}
 </section>;
}
