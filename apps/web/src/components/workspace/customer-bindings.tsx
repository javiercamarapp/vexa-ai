'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {CustomerBindingsView} from '../../../../../packages/workspace-service/detail.mjs';
export function CustomerBindings(){
 const [view,setView]=useState<CustomerBindingsView|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [key,setKey]=useState(''),[customerId,setCustomerId]=useState(''),[active,setActive]=useState(true),[report,setReport]=useState(''),[consent,setConsent]=useState('');
 const generation=useRef(0),controller=useRef<AbortController|null>(null);
 const request=useCallback(async(body?:unknown)=>{
  controller.current?.abort();const abort=new AbortController();controller.current=abort;const epoch=++generation.current;setBusy(true);setError('');setNotice('');setView(null);setConsent('');
  try{const response=await fetch('/api/workspace/customer-bindings',{method:body?'POST':'GET',cache:'no-store',signal:abort.signal,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});if(abort.signal.aborted||epoch!==generation.current)return;
   if(!response.ok)throw Error(response.status===401||response.status===403?'Tu acceso a las asociaciones de clientes cambió.':response.status===409?'La versión cambió. Actualiza y revisa antes de volver a aprobar.':'No se pudo consultar o guardar la asociación de cliente.');
   let json=await response.json();if(abort.signal.aborted||epoch!==generation.current)return;
   if(body){const fresh=await fetch('/api/workspace/customer-bindings',{cache:'no-store',signal:abort.signal});if(abort.signal.aborted||epoch!==generation.current)return;if(!fresh.ok)throw Error('La asociación se guardó, pero falta verificar su estado actual. Actualiza antes de continuar.');json=await fresh.json();}
   if(abort.signal.aborted||epoch!==generation.current)return;const data=json.data as CustomerBindingsView;if(!data||!Array.isArray(data.customers)||!Array.isArray(data.declaredKeys)||!Array.isArray(data.bindings))throw Error('No se pudo verificar la asociación recibida.');setView(data);if(body)setNotice('Asociación guardada. Abre una nueva vista de identidad para usarla; las vistas anteriores conservan su identidad histórica.');
  }catch(e){if(!abort.signal.aborted&&epoch===generation.current){setView(null);setConsent('');setError(e instanceof Error?e.message:'No se pudo completar la solicitud.');}}
  finally{if(!abort.signal.aborted&&epoch===generation.current)setBusy(false);}
 },[]);
 const invalidate=useCallback(()=>{controller.current?.abort();generation.current++;},[]);
 useEffect(()=>{let mounted=true;void Promise.resolve().then(()=>{if(mounted)void request();});return()=>{mounted=false;invalidate();};},[request,invalidate]);
 const prior=view?.bindings.filter(b=>b.customerKey===key).sort((a,b)=>b.version-a.version)[0];
 const body={customerKey:key,customerId,expectedVersion:prior?.version??0,active,report,attested:true},token=JSON.stringify(body);
 const valid=!!view?.declaredKeys.includes(key)&&!!view.customers.some(c=>c.id===customerId)&&report.trim().length>=20;
 const select=(value:string)=>{const old=view?.bindings.filter(b=>b.customerKey===value).sort((a,b)=>b.version-a.version)[0];setKey(value);setCustomerId(old?.valid?old.customerId:'');setActive(old?.active??true);setReport('');setConsent('');};
 return <section aria-label="Asociaciones de clientes"><h2>Asociar identidad financiera y cliente</h2><p>Relaciona el identificador declarado en las órdenes con un cliente conocido de tus fuentes. Compartir un problema o un nombre no demuestra que dos registros pertenezcan a la misma persona.</p>
  <button type="button" disabled={busy} onClick={()=>void request()}>Actualizar asociaciones de clientes</button>{busy&&<p role="status">Verificando asociaciones…</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {view&&<><p>{view.notice}</p>{view.canWrite?<form className="action-form" onSubmit={e=>{e.preventDefault();if(valid&&consent===token)void request(body);}}>
   <label htmlFor="customer-financial-key">Identificador financiero del cliente</label><select id="customer-financial-key" required value={key} onChange={e=>select(e.target.value)}><option value="">Seleccionar identificador</option>{view.declaredKeys.map(k=><option key={k} value={k}>{k}</option>)}</select>
   <label htmlFor="customer-canonical-id">Cliente conocido de la fuente</label><select id="customer-canonical-id" required value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">Seleccionar cliente</option>{view.customers.map(c=><option key={c.id} value={c.id}>{c.label} · {c.source}</option>)}</select>
   {key&&<p>Versión actual: {prior?.version??0}. {prior&&!prior.valid?'La asociación anterior ya no está autorizada.':''}</p>}
   <label><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>Asociación de cliente vigente</label>
   <label htmlFor="customer-binding-report">Razón y evidencia de identidad</label><textarea id="customer-binding-report" required minLength={20} maxLength={4000} value={report} onChange={e=>setReport(e.target.value)}/>
   <label><input type="checkbox" checked={consent===token} onChange={e=>setConsent(e.target.checked?token:'')}/>Confirmo la identidad y esta versión de la asociación</label>
   <button disabled={busy||!valid||consent!==token}>Guardar asociación de cliente</button>
  </form>:<p>Las asociaciones requieren aprobación del propietario; puedes consultar los detalles publicados con tus permisos actuales.</p>}
  {!view.declaredKeys.length&&<p>No hay identificadores financieros declarados para asociar.</p>}
  <ul>{view.bindings.map(b=><li key={b.id}>{b.customerKey} · v{b.version} · {b.active&&b.valid?'Vigente':'No vigente o no autorizada'}{b.valid?' · '+(view.customers.find(c=>c.id===b.customerId)?.label??'Cliente no disponible'):''}</li>)}</ul></>}
 </section>;
}
