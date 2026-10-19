// Cliente mínimo de OpenRouter. La llave se lee DENTRO del proceso y solo viaja en la cabecera Authorization.
// Nunca se imprime, registra ni se pasa por argumentos; los errores se sanean.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
export const BASE='https://openrouter.ai/api/v1';
export const DEFAULT_ENV=path.join(os.homedir(),'.codex-work/rovaq-cierre-20261007/.env.openrouter');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const scrub=s=>String(s??'').replace(/sk-[A-Za-z0-9_-]{8,}/g,'[redactado]').replace(/Bearer\s+\S+/g,'Bearer [redactado]');
export function createClient({envFile=process.env.OPENROUTER_ENV_FILE||DEFAULT_ENV,fetchImpl=globalThis.fetch,rps=6,timeoutMs=120000,key=null}={}){
  let KEY=key;const readKey=()=>{if(KEY)return KEY;const m=/^OPENROUTER_API_KEY=(.*)$/m.exec(fs.readFileSync(envFile,'utf8'));if(!m)throw Error('OPENROUTER_API_KEY no encontrada');return KEY=m[1].trim().replace(/^["']|["']$/g,'');};
  const headers=()=>({Authorization:'Bearer '+readKey(),'Content-Type':'application/json','X-Title':'vexa-ia-escala'});
  // limitador de tasa: como mucho `rps` inicios por segundo
  let next=0;const gate=async()=>{const now=Date.now();const at=Math.max(now,next);next=at+1000/rps;if(at>now)await sleep(at-now);};
  async function post(endpoint,body){
    let last={status:0,err:'sin intentos'};
    for(let a=0;a<3;a++){
      await gate();
      try{
        const t0=Date.now();
        const res=await fetchImpl(BASE+endpoint,{method:'POST',headers:headers(),body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
        const txt=await res.text();let json=null;try{json=JSON.parse(txt);}catch{}
        if((res.status===429||res.status>=500)&&a<2){last={status:res.status};await sleep(2000*(a+1));continue;}
        return{status:res.status,json,ms:Date.now()-t0,retries:a};
      }catch(e){last={status:0,err:scrub(e.message).slice(0,120)};if(a<2){await sleep(2000*(a+1));continue;}}
    }
    return{status:last.status,json:null,ms:0,retries:2,err:last.err};
  }
  async function get(endpoint){
    const res=await fetchImpl(BASE+endpoint,{headers:headers(),redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
    return{status:res.status,json:await res.json().catch(()=>null)};
  }
  return{post,get};
}
