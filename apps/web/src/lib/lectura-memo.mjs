// Memoria por instancia para lecturas pesadas y de solo lectura (Carga y SLA, Fuga de reembolsos): evita que varias pestañas o pantallas
// repitan la misma consulta de 10–25 s y saturen el pool de 5 conexiones. Clave = organización + ruta + consulta; la sesión y el rol se validan ANTES
// de consultar la memoria (nunca se sirve a otra organización). Dentro de `ttlMs` se devuelve el resultado; las peticiones simultáneas comparten UNA consulta.
// Un fallo no se guarda. Tope de entradas para no crecer sin límite.
const memoria=new Map(), enVuelo=new Map();
const TOPE=64;
// `rancioMs` (opcional): pasado el TTL, y dentro de esa ventana, se responde AL INSTANTE con el último resultado bueno y se relee por detrás (una sola relectura); si la relectura
// falla o sale degradada (`noGuardar`), se conserva el resultado bueno. Cada resultado trae su `generatedAt`: no se hace pasar por reciente. Sin `rancioMs` el comportamiento es el de siempre.
export async function conMemoria(clave, ttlMs, leer, ahora=()=>Date.now(), {rancioMs=0,noGuardar=null}={}) {
  const hit=memoria.get(clave);
  const edad=hit?ahora()-hit.t:Infinity;
  if(hit&&edad<ttlMs)return hit.v;
  const lanzar=()=>{
    const p=(async()=>{
      try{const v=await leer();if(!(noGuardar&&noGuardar(v))){memoria.set(clave,{t:ahora(),v});if(memoria.size>TOPE)memoria.delete(memoria.keys().next().value);}return v;}
      finally{enVuelo.delete(clave);}
    })();
    enVuelo.set(clave,p);
    return p;
  };
  if(hit&&rancioMs>0&&edad<ttlMs+rancioMs){
    if(!enVuelo.has(clave))lanzar().catch(()=>{});
    return hit.v;
  }
  if(enVuelo.has(clave))return enVuelo.get(clave);
  return lanzar();
}
export function olvidarMemoria(){memoria.clear();enVuelo.clear();}
/** Una lectura parcial (para `noGuardar`: true si alguna parte quedó «unavailable»). */
export function esDegradada(valor){try{return JSON.stringify(valor).includes('"unavailable"');}catch{return true;}}
/** Una lectura parcial (alguna parte «unavailable» por tiempo) no se queda en memoria: la siguiente petición reintenta. */
export function olvidarSiDegradada(clave,valor){try{if(JSON.stringify(valor).includes('"unavailable"'))memoria.delete(clave);}catch{memoria.delete(clave);}return valor;}
