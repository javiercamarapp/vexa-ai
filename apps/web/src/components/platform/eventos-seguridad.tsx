import {platformMfaGate, type Access} from '../../app/(app)/platform/_lib/access';
import {traductor} from '../../lib/i18n';
import {idiomaActual} from '../../lib/i18n/servidor';
import {formatosDe} from '../../lib/i18n/formatos';

/* Eventos de seguridad (auditoría 3): componente de SERVIDOR. Lee solo por las funciones public.platform_security_events / platform_security_alerts,
   que exigen administrador de plataforma con sesión viva. Muestra la huella de IP truncada (ipRef), nunca la IP. */
type Fila={id:number;at:string;kind:string;severity:string;route:string|null;method:string|null;tenantId:string|null;actorId:string|null;ipRef:string|null;ua:string|null;detail:Record<string,unknown>};
export const TIPOS=['auth_401','forbidden_403','csrf_rejected','bearer_invalid','webhook_signature_invalid','rate_limited','support_start','support_end','support_blocked','export','invitation_sent','alert_raised','body_limit'] as const;
const SEV=['info','warn','high'] as const;
export type Filtros={kind?:string;severity?:string;since?:string};
/** Solo valores conocidos llegan a la base (la propia función vuelve a validar). */
export function filtrosSeguros(q:Record<string,string|string[]|undefined>):Filtros&{valido:boolean}{
  const uno=(v:string|string[]|undefined)=>typeof v==='string'?v:undefined;
  const kind=uno(q.kind),severity=uno(q.severity),since=uno(q.since);
  return {kind:kind&&(TIPOS as readonly string[]).includes(kind)?kind:undefined,severity:severity&&(SEV as readonly string[]).includes(severity)?severity:undefined,
    since:since&&!Number.isNaN(Date.parse(since))?new Date(since).toISOString():undefined,valido:true};
}
const tono=(s:string)=>s==='high'?'#b3261e':s==='warn'?'#8a5a00':'inherit';
export async function EventosSeguridad({access,searchParams}:{access:Access|null;searchParams:Record<string,string|string[]|undefined>}){
  if(!access||access.mode!=='live'||!access.client)return null;
  if(await platformMfaGate(access)!=='ok')return null;
  const idioma=await idiomaActual(),t=traductor(idioma),fmt=formatosDe(idioma);
  const f=filtrosSeguros(searchParams);
  const r=await access.client.rpc('platform_security_events',{p_input:{kind:f.kind,severity:f.severity,since:f.since,limit:50}});
  const filas:Fila[]=r.error?[]:(r.data?.items??[]);
  return <section className="pf-page" aria-labelledby="sec-ev-titulo" style={{marginTop:24}}>
    <h2 id="sec-ev-titulo">{t('tr.sec.titulo')}</h2>
    <p>{t('tr.sec.desc')}</p>
    <form method="get" style={{display:'flex',gap:8,flexWrap:'wrap',margin:'12px 0'}}>
      <label>{t('tr.sec.tipo')} <select name="kind" defaultValue={f.kind??''}><option value="">{t('tr.sec.todos')}</option>{TIPOS.map(k=><option key={k} value={k}>{k}</option>)}</select></label>
      <label>{t('tr.sec.severidad')} <select name="severity" defaultValue={f.severity??''}><option value="">{t('tr.sec.todas')}</option>{SEV.map(k=><option key={k} value={k}>{k}</option>)}</select></label>
      <label>{t('tr.sec.desde')} <input type="date" name="since" defaultValue={f.since?.slice(0,10)??''} /></label>
      <button type="submit">{t('tr.sec.filtrar')}</button>
    </form>
    {r.error?<p role="alert">{t('tr.sec.errorLeer')}</p>:filas.length===0?<p>{t('tr.sec.vacio')}</p>:
    <div style={{overflowX:'auto'}}><table className="pf-table" style={{width:'100%'}}>
      <thead><tr><th>{t('tr.sec.fecha')}</th><th>{t('tr.sec.tipo')}</th><th>{t('tr.sec.severidad')}</th><th>{t('tr.sec.ruta')}</th><th>{t('tr.sec.metodo')}</th><th>{t('tr.sec.org')}</th><th>{t('tr.sec.actor')}</th><th>{t('tr.sec.ip')}</th><th>{t('tr.sec.detalle')}</th></tr></thead>
      <tbody>{filas.map(e=><tr key={e.id}><td>{fmt.fechaHora(e.at)}</td><td>{e.kind}</td><td style={{color:tono(e.severity)}}>{e.severity}</td><td>{e.route??''}</td><td>{e.method??''}</td><td>{e.tenantId?.slice(0,8)??''}</td><td>{e.actorId?.slice(0,8)??''}</td><td>{e.ipRef??''}</td><td>{Object.entries(e.detail??{}).map(([k,v])=>k+'='+String(v)).join(' ')}</td></tr>)}</tbody>
    </table></div>}
  </section>;
}
export async function AlertasSeguridad({access}:{access:Access|null}){
  if(!access||access.mode!=='live'||!access.client)return null;
  if(await platformMfaGate(access)!=='ok')return null;
  const t=traductor(await idiomaActual());
  const r=await access.client.rpc('platform_security_alerts',{p_window:'15 minutes'});
  const alertas:Array<{id:string;severity:string;hits:number;title:string}>=r.error?[]:(r.data?.alerts??[]);
  return <section className="pf-page" aria-labelledby="sec-al-titulo" style={{marginBottom:16}}>
    <h2 id="sec-al-titulo">{t('tr.sec.alertasTitulo')}</h2>
    {r.error?<p>{t('tr.sec.alertasSinDatos')}</p>:alertas.length===0?<p>{t('tr.sec.sinAlertas')}</p>:<ul>{alertas.map(a=><li key={a.id} style={{color:tono(a.severity)}}><strong>{a.title}</strong>: {a.hits}</li>)}</ul>}
  </section>;
}
