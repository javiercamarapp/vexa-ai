// Petición con un reintento automático. La primera carga en frío del corte puede pasar de 25 s: se espera más y,
// si el intento falla por tiempo, red o 5xx, se repite UNA vez (avisando «Reintentando…») antes de mostrar el error.
// Los 4xx (acceso, alcance inválido) y el 404 (sin publicación) no se reintentan: no cambian por esperar.
export const PLAZOS_MS=[45000,70000];
// Pausa breve antes del reintento: justo tras la redirección de /login a /overview la primera petición puede fallar por la sesión recién creada (R2-3-001) y un reintento inmediato fallaría igual.
export const ESPERA_REINTENTO_MS=1500;
const dormir=(ms,signal)=>new Promise((res,rej)=>{if(!ms)return res();const t=setTimeout(res,ms);signal?.addEventListener('abort',()=>{clearTimeout(t);rej(new DOMException('Aborted','AbortError'));},{once:true});});
/** «Failed to fetch» y similares (inglés del navegador) -> mensaje en español; cualquier otro error conserva su texto. */
export const MENSAJE_SIN_CONEXION='No se pudo conectar con el servicio. Pulsa Actualizar para reintentar.';
export const MENSAJE_REINTENTANDO='No se pudo conectar; reintentando…';
export const esErrorDeRed=e=>!!e&&(e instanceof TypeError||/failed to fetch|load failed|networkerror|fetch failed|network request failed/i.test(String(e.message??e)));
export const mensajeDeError=(e,otro)=>esErrorDeRed(e)?MENSAJE_SIN_CONEXION:(e instanceof Error&&e.message?e.message:otro);
/** pedir(signal) -> {status, json?}. Devuelve {status,json,intentos} o {timedOut:true,intentos}. Si `signal` se aborta, relanza el AbortError. */
export async function pedirConReintento(pedir,{plazos=PLAZOS_MS,onReintentando=()=>{},signal,esperaMs=ESPERA_REINTENTO_MS}={}){
 const ultimo=plazos.length-1;
 for(let i=0;i<=ultimo;i++){
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  const c=new AbortController();let agotado=false;
  const cortar=()=>c.abort();signal?.addEventListener('abort',cortar);
  const t=setTimeout(()=>{agotado=true;c.abort();},plazos[i]);
  try{
   const res=await pedir(c.signal);
   if(signal?.aborted)throw new DOMException('Aborted','AbortError');
   if(res.status>=500&&i<ultimo){onReintentando(i+1,res);await dormir(esperaMs,signal);continue;}
   return {...res,intentos:i+1};
  }catch(e){
   if(signal?.aborted)throw e;
   if(i<ultimo){onReintentando(i+1,e);await dormir(esperaMs,signal);continue;}
   if(agotado)return {timedOut:true,intentos:i+1};
   throw e;
  }finally{clearTimeout(t);signal?.removeEventListener('abort',cortar);}
 }
 throw new Error('plazos vacíos');
}
