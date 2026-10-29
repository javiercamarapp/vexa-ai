'use client';
import {useAutoRefresh} from '../ui/use-auto-refresh';
import {useLayoutEffect,useCallback,useEffect,useRef,useState} from 'react';
import type {CustomerBindingsView} from '../../../../../packages/workspace-service/detail.mjs';
import {useT} from '../i18n/proveedor';
import type {Clave} from '../../lib/i18n';
export function CustomerBindings(){
 const tx=useT(),em=(m:string)=>m.startsWith('tr.ws.')?tx(m as Clave):m;
 const [view,setView]=useState<CustomerBindingsView|null>(null),[loaded,setLoaded]=useState(false),[kq,setKq]=useState(''),[cq,setCq]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [key,setKey]=useState(''),[customerId,setCustomerId]=useState(''),[active,setActive]=useState(true),[report,setReport]=useState(''),[consent,setConsent]=useState('');
 const generation=useRef(0),controller=useRef<AbortController|null>(null);
 const request=useCallback(async(body?:unknown,keyQ='',custQ='')=>{
  controller.current?.abort();const abort=new AbortController();controller.current=abort;const epoch=++generation.current;setBusy(true);setError('');setNotice('');setConsent('');
  try{const qs=new URLSearchParams({limit:'25',...(keyQ?{q:keyQ}:{}),...(custQ?{customerQ:custQ}:{})}).toString();const response=await fetch('/api/workspace/customer-bindings'+(body?'':'?'+qs),{method:body?'POST':'GET',cache:'no-store',signal:abort.signal,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});if(abort.signal.aborted||epoch!==generation.current)return;
   if(!response.ok)throw Error(response.status===401||response.status===403?'tr.ws.cbE401':response.status===409?'tr.ws.e409':response.status===504?'tr.ws.e504':'tr.ws.cbELeer');
   let json=await response.json();if(abort.signal.aborted||epoch!==generation.current)return;
   if(body){const fresh=await fetch('/api/workspace/customer-bindings?limit=25'+(keyQ?'&q='+encodeURIComponent(keyQ):'')+(custQ?'&customerQ='+encodeURIComponent(custQ):''),{cache:'no-store',signal:abort.signal});if(abort.signal.aborted||epoch!==generation.current)return;if(!fresh.ok)throw Error('tr.ws.cbEFalta');json=await fresh.json();}
   if(abort.signal.aborted||epoch!==generation.current)return;const data=json.data as CustomerBindingsView;if(!data||!Array.isArray(data.customers)||!Array.isArray(data.declaredKeys)||!Array.isArray(data.bindings))throw Error('tr.ws.cbEVerif');setView(data);setLoaded(true);if(body)setNotice('tr.ws.cbGuardada');
  }catch(e){if(!abort.signal.aborted&&epoch===generation.current){setView(null);setConsent('');setError(e instanceof Error?e.message:'tr.ws.eSolicitud');}}
  finally{if(!abort.signal.aborted&&epoch===generation.current)setBusy(false);}
 },[]);
 const invalidate=useCallback(()=>{controller.current?.abort();generation.current++;},[]);
 useEffect(()=>()=>{invalidate();},[invalidate]);
 const prior=view?.bindings.filter(b=>b.customerKey===key).sort((a,b)=>b.version-a.version)[0];
 const body={customerKey:key,customerId,expectedVersion:prior?.version??0,active,report,attested:true},token=JSON.stringify(body);
 const valid=!!view?.declaredKeys.includes(key)&&!!view.customers.some(c=>c.id===customerId)&&report.trim().length>=20;
 const select=(value:string)=>{const old=view?.bindings.filter(b=>b.customerKey===value).sort((a,b)=>b.version-a.version)[0];setKey(value);setCustomerId(old?.valid?old.customerId:'');setActive(old?.active??true);setReport('');setConsent('');};
 // Datos nuevos: relectura en segundo plano de la primera página con la búsqueda actual; conserva lo pintado y el consentimiento en curso, y no corre durante una operación.
 const busyRef=useRef(true),kqRef=useRef(''),cqRef=useRef('');useLayoutEffect(()=>{busyRef.current=busy;kqRef.current=kq;cqRef.current=cq;});
 useAutoRefresh(async()=>{if(busyRef.current)return;const epoch=generation.current;const qs=new URLSearchParams({limit:'25',...(kqRef.current.trim()?{q:kqRef.current.trim()}:{}),...(cqRef.current.trim()?{customerQ:cqRef.current.trim()}:{})});const r=await fetch('/api/workspace/customer-bindings?'+qs,{cache:'no-store'});if(!r.ok)return;const j=await r.json();const d=j?.data as CustomerBindingsView;if(epoch===generation.current&&!busyRef.current&&d&&Array.isArray(d.customers)&&Array.isArray(d.declaredKeys)&&Array.isArray(d.bindings))setView(d);},{ocupado:()=>busyRef.current});
 return <section aria-label={tx('tr.ws.cbAria')}><h2>{tx('tr.ws.cbH2')}</h2><p>{tx('tr.ws.cbIntro')}</p>
  <form onSubmit={e=>{e.preventDefault();void request(undefined,kq.trim(),cq.trim());}}><label>{tx('tr.ws.cbBuscarId')}<input value={kq} maxLength={100} onChange={e=>setKq(e.target.value)}/></label> <label>{tx('tr.ws.cbBuscarCli',{n:2})}<input value={cq} maxLength={100} onChange={e=>setCq(e.target.value)}/></label> <button disabled={busy}>{loaded?tx('tr.ws.buscar'):tx('tr.ws.cbCargar')}</button></form>{busy&&<p role="status" className="sr-only">{tx('tr.ws.cbVerificando')}</p>}{error&&<p role="status">{em(error)} <button type="button" disabled={busy} onClick={()=>void request(undefined,kq.trim(),cq.trim())}>{tx('hoy.reintentar')}</button></p>}{notice&&<p role="status">{em(notice)}</p>}
  {view&&<><p>{view.notice}</p>{view.canWrite?<form className="action-form" onSubmit={e=>{e.preventDefault();if(valid&&consent===token)void request(body);}}>
   <label htmlFor="customer-financial-key">{tx('tr.ws.cbIdFin')}</label><select id="customer-financial-key" required value={key} onChange={e=>select(e.target.value)}><option value="">{tx('tr.ws.cbSelId')}</option>{view.declaredKeys.map(k=><option key={k} value={k}>{k}</option>)}</select>
   <label htmlFor="customer-canonical-id">{tx('tr.ws.cbCliConocido')}</label><select id="customer-canonical-id" required value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">{tx('tr.ws.cbSelCli')}</option>{view.customers.map(c=><option key={c.id} value={c.id}>{c.label} · {c.source}</option>)}</select>
   {key&&<p>{tx('tr.ws.versionActual',{v:prior?.version??0,nota:prior&&!prior.valid?tx('tr.ws.cbYaNoAut'):''})}</p>}
   <label><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>{tx('tr.ws.cbVigente')}</label>
   <label htmlFor="customer-binding-report">{tx('tr.ws.cbRazon')}</label><textarea id="customer-binding-report" required minLength={20} maxLength={4000} value={report} onChange={e=>setReport(e.target.value)}/>
   <label><input type="checkbox" checked={consent===token} onChange={e=>setConsent(e.target.checked?token:'')}/>{tx('tr.ws.cbConfirmo')}</label>
   <button disabled={busy||!valid||consent!==token}>{tx('tr.ws.cbGuardar')}</button>
  </form>:<p>{tx('tr.ws.cbRequiere')}</p>}
  {!view.declaredKeys.length&&<p>{tx('tr.ws.cbSinIds')}</p>}
  <ul>{(((view as unknown as {recentBindings?:typeof view.bindings}).recentBindings)??view.bindings).map(b=><li key={b.id}>{b.customerKey} · v{b.version} · {b.active&&b.valid?tx('tr.ws.vigente'):tx('tr.ws.noVigente')}{b.valid?' · '+((view.customers.find(c=>c.id===b.customerId)?.label)??((view as unknown as {boundCustomers?:{id:string;label:string}[]}).boundCustomers?.find(c=>c.id===b.customerId)?.label)??tx('tr.ws.cbNoDisp')):''}</li>)}</ul></>}
 </section>;
}
