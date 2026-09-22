'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {formatMinorUnits} from '../../../../../packages/metrics/money.mjs';
type Order={ledgerRowId:string;entityId:string;externalId:string;currency:string;exponent:number;amountMinor:string|null;sourceName:string};
type Mapping={id:string;ledgerRowId:string;version:number;skus:string[]|null;source:string|null;active:boolean;valid:boolean;report:string|null};
type View={orders:Order[];mappings:Mapping[];canWrite:boolean};
export function OrderMappings(){
 const [view,setView]=useState<View|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[rowId,setRowId]=useState(''),[skuKnown,setSkuKnown]=useState(false),[skuText,setSkuText]=useState(''),[source,setSource]=useState(''),[active,setActive]=useState(true),[report,setReport]=useState(''),[consent,setConsent]=useState('');
 const generation=useRef(0),controller=useRef<AbortController|null>(null);
 const request=useCallback(async(body?:unknown)=>{
  controller.current?.abort();const abort=new AbortController();controller.current=abort;const epoch=++generation.current;setBusy(true);setError('');setNotice('');
  try{const response=await fetch('/api/workspace/mappings',{method:body?'POST':'GET',cache:'no-store',signal:abort.signal,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});if(abort.signal.aborted||epoch!==generation.current)return;
   if(!response.ok)throw Error(response.status===401||response.status===403?'Tu acceso a la clasificación de órdenes cambió.':response.status===409?'La versión cambió. Actualiza y revisa antes de volver a aprobar.':'No se pudo consultar o guardar la clasificación de órdenes.');
   let json=await response.json();if(abort.signal.aborted||epoch!==generation.current)return;
   if(body){setConsent('');const fresh=await fetch('/api/workspace/mappings',{cache:'no-store',signal:abort.signal});if(abort.signal.aborted||epoch!==generation.current)return;if(!fresh.ok)throw Error('El registro se guardó, pero no se pudo verificar la vista actual. Actualiza antes de continuar.');json=await fresh.json();}
   if(abort.signal.aborted||epoch!==generation.current)return;const data=json.data as View;if(!data||!Array.isArray(data.orders)||!Array.isArray(data.mappings))throw Error('No se pudo verificar la clasificación recibida.');setView(data);if(body)setNotice('Clasificación guardada. Las vistas ya fijadas conservan su versión; abre una vista nueva para usar este cambio.');
  }catch(e){if(!abort.signal.aborted&&epoch===generation.current){setView(null);setConsent('');setError(e instanceof Error?e.message:'No se pudo completar la solicitud.');}}
  finally{if(!abort.signal.aborted&&epoch===generation.current)setBusy(false);}
 },[]);
 const invalidate=useCallback(()=>{controller.current?.abort();generation.current++;},[]);
 useEffect(()=>{let active=true;void Promise.resolve().then(()=>{if(active)void request();});return()=>{active=false;invalidate();};},[request,invalidate]);
 const selected=view?.orders.find(x=>x.ledgerRowId===rowId),mapping=view?.mappings.filter(x=>x.ledgerRowId===rowId).sort((a,b)=>b.version-a.version)[0];
 const skus=skuKnown?[...new Set(skuText.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))].sort():null;
 const body={ledgerRowId:rowId,expectedVersion:mapping?.version??0,skus,source:source||null,active,report,attested:true},token=JSON.stringify(body);
 const select=(id:string)=>{const prior=view?.mappings.filter(x=>x.ledgerRowId===id).sort((a,b)=>b.version-a.version)[0];setRowId(id);setSkuKnown(prior?.skus!==null&&prior?.skus!==undefined);setSkuText(prior?.skus?.join('\n')??'');setSource(prior?.source??'');setActive(prior?.active??true);setReport('');setConsent('');setNotice('');};
 return <section aria-label="Clasificación de órdenes"><h2>Clasificación de órdenes</h2><p>Asocia SKU y origen sólo con evidencia verificable. Un SKU identifica una orden que contiene el producto; no reparte su importe por líneas. Dejar un dato desconocido conserva esa limitación en los filtros.</p>
  <button type="button" disabled={busy} onClick={()=>void request()}>Actualizar clasificación de órdenes</button>{busy&&<p role="status">Verificando clasificaciones…</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {view&&<>{!view.orders.length&&<p>No hay órdenes autorizadas para clasificar.</p>}{view.canWrite&&<form className="action-form" onSubmit={e=>{e.preventDefault();if(selected&&consent===token)void request(body);}}>
   <label>Orden para clasificar<select required value={rowId} onChange={e=>select(e.target.value)}><option value="">Seleccionar orden</option>{view.orders.map(o=><option key={o.ledgerRowId} value={o.ledgerRowId}>{o.externalId} · {formatMinorUnits(o.amountMinor,o.currency,o.exponent)} · {o.sourceName}</option>)}</select></label>
   {selected&&<p>Revisión de clasificación actual: {mapping?.version??0}. {mapping&&!mapping.valid?'La asociación anterior no está autorizada; una nueva decisión requiere evidencia vigente.':''}</p>}
   <label><input type="checkbox" checked={skuKnown} onChange={e=>setSkuKnown(e.target.checked)}/>Conozco la lista de SKU de esta orden</label>
   {skuKnown&&<label>SKU de la orden, uno por línea<textarea value={skuText} onChange={e=>setSkuText(e.target.value)} rows={3}/><small>Una lista vacía aprobada significa que la orden no tiene SKU asignados.</small></label>}
   <label>Origen confirmado<select value={source} onChange={e=>setSource(e.target.value)}><option value="">Desconocido</option><option value="hubspot">HubSpot</option><option value="zendesk">Zendesk</option><option value="csv">CSV</option><option value="excel">Excel</option></select></label>
   <label><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>Asociación vigente</label>
   <label>Razón y evidencia de la clasificación<textarea required minLength={20} maxLength={4000} value={report} onChange={e=>setReport(e.target.value)}/></label>
   <label><input type="checkbox" checked={consent===token} onChange={e=>setConsent(e.target.checked?token:'')}/>Confirmo la evidencia y esta versión de la clasificación</label>
   <button disabled={busy||!selected||consent!==token}>Guardar clasificación de orden</button>
  </form>}{!view.canWrite&&<p>La clasificación requiere aprobación del propietario. Puedes consultar los alcances publicados con tus permisos actuales.</p>}
  <ul>{view.mappings.map(m=><li key={m.id}>Orden {view.orders.find(o=>o.ledgerRowId===m.ledgerRowId)?.externalId??m.ledgerRowId} · v{m.version} · {m.valid&&m.active?'Vigente':'No vigente o no autorizada'} · SKU: {m.skus===null?'Desconocidos':m.skus.join(', ')||'Sin SKU'} · Origen: {m.source??'Desconocido'}</li>)}</ul></>}
 </section>;
}
