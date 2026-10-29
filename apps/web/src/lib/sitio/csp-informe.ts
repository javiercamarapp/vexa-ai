// Normalización de informes de violación de CSP (T3): sin PII, solo directiva, origen bloqueado sin ruta y ruta del documento sin consulta.
const origen=(u:unknown)=>{if(typeof u!=='string')return null;if(/^(?:inline|eval|data|blob|about)$/.test(u))return u;try{const x=new URL(u);return x.origin;}catch{return null;}};
const ruta=(u:unknown)=>{if(typeof u!=='string')return null;try{return new URL(u).pathname.slice(0,120);}catch{return null;}};
const texto=(v:unknown,n=60)=>typeof v==='string'&&/^[\w\-' .:/*]+$/.test(v)?v.slice(0,n):null;
/** Normaliza los dos formatos: application/csp-report ({"csp-report":{...}}) y Reporting API (application/reports+json: lista de {type, body}). */
export function extraerInformes(cuerpo:unknown):{directiva:string|null;bloqueado:string|null;documento:string|null}[]{
  const lista=Array.isArray(cuerpo)?cuerpo:[cuerpo];const salida:{directiva:string|null;bloqueado:string|null;documento:string|null}[]=[];
  for(const e of lista.slice(0,5)){
    if(!e||typeof e!=='object')continue;const o=e as Record<string,unknown>;
    const r=(o['csp-report']??o.body??null) as Record<string,unknown>|null;if(!r||typeof r!=='object')continue;
    salida.push({directiva:texto(r['effective-directive']??r.effectiveDirective??r['violated-directive']),bloqueado:origen(r['blocked-uri']??r.blockedURL),documento:ruta(r['document-uri']??r.documentURL)});
  }
  return salida;
}
