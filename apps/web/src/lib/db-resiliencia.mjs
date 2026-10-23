// Resiliencia del pool de PostgreSQL ante el pooler de Supabase (puerto 6543), que corta conexiones inactivas o saturadas.
// Causa raiz de «detail_request_failed», «Corte publicado: No disponible ahora» y los 503 de /facts y /trends (23-oct): un cliente del pool
// cortado en silencio («Connection terminated unexpectedly») se entregaba a la siguiente peticion, y como el Pool no tenia manejador de
// 'error' el corte de un cliente inactivo era una excepcion no capturada que mataba la instancia (exit 129) y las peticiones en vuelo.
const CODIGOS=new Set(['ECONNRESET','EPIPE','ETIMEDOUT','57P01','57P02','57P03','08000','08001','08003','08006']);
const TEXTO=/connection terminated|connection (?:is )?closed|client has encountered a connection error|server closed the connection|socket hang up|read econnreset/i;
export function esErrorDeConexion(error){
 if(!error||typeof error!=='object')return false;
 const e=error;
 return CODIGOS.has(String(e.code??''))||TEXTO.test(String(e.message??''));
}
/** Pide una conexion y la comprueba con `comprobar`; si esta muerta la destruye (release(error)) y reintenta con otra. */
export async function conectarConReintento(driver,comprobar,{intentos=2}={}){
 let ultimo;
 for(let i=0;i<intentos;i++){
  const c=await driver.connect();
  try{await comprobar(c);return c;}
  catch(error){
   if(esErrorDeConexion(error)){ultimo=error;try{c.release(error);}catch{/* ya destruida */}continue;}
   try{c.release();}catch{/* nunca exponer detalles del driver */}
   throw error;
  }
 }
 throw ultimo;
}
/** Un cliente inactivo cortado emite 'error' en el pool; sin escuchador Node lo trata como excepcion no capturada. */
export function vigilarPool(pool,avisar=(m)=>console.warn(m)){
 pool.on('error',(error)=>{avisar('db-pool: cliente inactivo cortado y descartado ('+(error&&error.code?error.code:'sin_codigo')+')');});
 return pool;
}
