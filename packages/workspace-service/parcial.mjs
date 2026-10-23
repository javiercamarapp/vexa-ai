// Degradación honesta por bloque: un bloque opcional de una ficha que falla (tiempo agotado, evidencia no verificable, error de SQL) no tumba la ficha entera.
// Se ejecuta bajo SAVEPOINT para que el error no deje abortada la transacción (25P02); una conexión cortada sí se propaga (no hay nada que salvar).
const CORTADA=/connection terminated|connection (?:is )?closed|client has encountered a connection error|server closed the connection|socket hang up/i;
const cortada=e=>!!e&&typeof e==='object'&&(['ECONNRESET','EPIPE','57P01','57P02','57P03','08000','08003','08006'].includes(String(e.code??''))||CORTADA.test(String(e.message??'')));
let seq=0;
/** @returns {Promise<{ok:true,value:any}|{ok:false,code:string}>} */
export async function bloqueOpcional(s,fn){
 const name='vexa_bloque_'+(++seq%1000000);
 await s.query('SAVEPOINT '+name);
 try{const value=await fn();await s.query('RELEASE SAVEPOINT '+name);return {ok:true,value};}
 catch(error){
  if(cortada(error))throw error;
  await s.query('ROLLBACK TO SAVEPOINT '+name);await s.query('RELEASE SAVEPOINT '+name);
  const code=error&&typeof error==='object'&&typeof error.code==='string'?error.code:(error&&typeof error==='object'&&typeof error.message==='string'&&/^[a-z_]{3,60}$/.test(error.message)?error.message:'bloque_no_disponible');
  return {ok:false,code};
 }
}
