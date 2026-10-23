// Petición con un reintento automático. La primera carga en frío del corte puede pasar de 25 s: se espera más y,
// si el intento falla por tiempo, red o 5xx, se repite UNA vez (avisando «Reintentando…») antes de mostrar el error.
// Los 4xx (acceso, alcance inválido) y el 404 (sin publicación) no se reintentan: no cambian por esperar.
export const PLAZOS_MS=[45000,70000];
/** pedir(signal) -> {status, json?}. Devuelve {status,json,intentos} o {timedOut:true,intentos}. Si `signal` se aborta, relanza el AbortError. */
export async function pedirConReintento(pedir,{plazos=PLAZOS_MS,onReintentando=()=>{},signal}={}){
 const ultimo=plazos.length-1;
 for(let i=0;i<=ultimo;i++){
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  const c=new AbortController();let agotado=false;
  const cortar=()=>c.abort();signal?.addEventListener('abort',cortar);
  const t=setTimeout(()=>{agotado=true;c.abort();},plazos[i]);
  try{
   const res=await pedir(c.signal);
   if(signal?.aborted)throw new DOMException('Aborted','AbortError');
   if(res.status>=500&&i<ultimo){onReintentando(i+1);continue;}
   return {...res,intentos:i+1};
  }catch(e){
   if(signal?.aborted)throw e;
   if(i<ultimo){onReintentando(i+1);continue;}
   if(agotado)return {timedOut:true,intentos:i+1};
   throw e;
  }finally{clearTimeout(t);signal?.removeEventListener('abort',cortar);}
 }
 throw new Error('plazos vacíos');
}
