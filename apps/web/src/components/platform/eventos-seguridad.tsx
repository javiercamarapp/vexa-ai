import {platformMfaGate, type Access} from '../../app/(app)/platform/_lib/access';

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
  const f=filtrosSeguros(searchParams);
  const r=await access.client.rpc('platform_security_events',{p_input:{kind:f.kind,severity:f.severity,since:f.since,limit:50}});
  const filas:Fila[]=r.error?[]:(r.data?.items??[]);
  return <section className="pf-page" aria-labelledby="sec-ev-titulo" style={{marginTop:24}}>
    <h2 id="sec-ev-titulo">Eventos de seguridad</h2>
    <p>Accesos denegados, origen inválido, Bearer y firmas inválidas, bloqueos por límite, entrada y salida de «Ver como» y exportaciones. Sin contenido de clientes; la IP aparece solo como huella parcial. Los eventos repetidos se muestrean: la columna Detalle trae el total cuando aplica.</p>
    <form method="get" style={{display:'flex',gap:8,flexWrap:'wrap',margin:'12px 0'}}>
      <label>Tipo <select name="kind" defaultValue={f.kind??''}><option value="">Todos</option>{TIPOS.map(k=><option key={k} value={k}>{k}</option>)}</select></label>
      <label>Severidad <select name="severity" defaultValue={f.severity??''}><option value="">Todas</option>{SEV.map(k=><option key={k} value={k}>{k}</option>)}</select></label>
      <label>Desde <input type="date" name="since" defaultValue={f.since?.slice(0,10)??''} /></label>
      <button type="submit">Filtrar</button>
    </form>
    {r.error?<p role="alert">No se pudieron leer los eventos (la migración de eventos de seguridad puede no estar aplicada).</p>:filas.length===0?<p>Sin eventos para este filtro.</p>:
    <div style={{overflowX:'auto'}}><table className="pf-table" style={{width:'100%'}}>
      <thead><tr><th>Fecha</th><th>Tipo</th><th>Severidad</th><th>Ruta</th><th>Método</th><th>Organización</th><th>Actor</th><th>IP (huella)</th><th>Detalle</th></tr></thead>
      <tbody>{filas.map(e=><tr key={e.id}><td>{new Date(e.at).toLocaleString('es-MX')}</td><td>{e.kind}</td><td style={{color:tono(e.severity)}}>{e.severity}</td><td>{e.route??''}</td><td>{e.method??''}</td><td>{e.tenantId?.slice(0,8)??''}</td><td>{e.actorId?.slice(0,8)??''}</td><td>{e.ipRef??''}</td><td>{Object.entries(e.detail??{}).map(([k,v])=>k+'='+String(v)).join(' ')}</td></tr>)}</tbody>
    </table></div>}
  </section>;
}
export async function AlertasSeguridad({access}:{access:Access|null}){
  if(!access||access.mode!=='live'||!access.client)return null;
  if(await platformMfaGate(access)!=='ok')return null;
  const r=await access.client.rpc('platform_security_alerts',{p_window:'15 minutes'});
  const alertas:Array<{id:string;severity:string;hits:number;title:string}>=r.error?[]:(r.data?.alerts??[]);
  return <section className="pf-page" aria-labelledby="sec-al-titulo" style={{marginBottom:16}}>
    <h2 id="sec-al-titulo">Alertas de seguridad (últimos 15 minutos)</h2>
    {r.error?<p>Sin datos de seguridad todavía.</p>:alertas.length===0?<p>Sin alertas por umbral.</p>:<ul>{alertas.map(a=><li key={a.id} style={{color:tono(a.severity)}}><strong>{a.title}</strong>: {a.hits}</li>)}</ul>}
  </section>;
}
