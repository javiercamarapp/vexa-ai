// Memoria por instancia para lecturas pesadas y de solo lectura (Carga y SLA, Fuga de reembolsos): evita que varias pestañas o pantallas
// repitan la misma consulta de 10–25 s y saturen el pool de 5 conexiones. Clave = organización + ruta + consulta; la sesión y el rol se validan ANTES
// de consultar la memoria (nunca se sirve a otra organización). Dentro de `ttlMs` se devuelve el resultado; las peticiones simultáneas comparten UNA consulta.
// Un fallo no se guarda. Tope de entradas para no crecer sin límite.
const memoria=new Map(), enVuelo=new Map();
const TOPE=64;
export async function conMemoria(clave, ttlMs, leer, ahora=()=>Date.now()) {
  const hit=memoria.get(clave);
  if(hit&&ahora()-hit.t<ttlMs)return hit.v;
  if(enVuelo.has(clave))return enVuelo.get(clave);
  const p=(async()=>{
    try{const v=await leer();memoria.set(clave,{t:ahora(),v});if(memoria.size>TOPE)memoria.delete(memoria.keys().next().value);return v;}
    finally{enVuelo.delete(clave);}
  })();
  enVuelo.set(clave,p);
  return p;
}
export function olvidarMemoria(){memoria.clear();enVuelo.clear();}
/** Una lectura parcial (alguna parte «unavailable» por tiempo) no se queda en memoria: la siguiente petición reintenta. */
export function olvidarSiDegradada(clave,valor){try{if(JSON.stringify(valor).includes('"unavailable"'))memoria.delete(clave);}catch{memoria.delete(clave);}return valor;}
