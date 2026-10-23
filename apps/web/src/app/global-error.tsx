'use client';
import {useRecuperacionChunk} from '../components/ui/recuperar-chunk';
/** Último recurso (falla el layout raíz): misma recuperación de ChunkLoadError, sin depender de estilos. */
export default function GlobalError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 const {chunk,recargando,reintentar}=useRecuperacionChunk(error,reset);
 return <html lang="es"><body style={{fontFamily:'system-ui,sans-serif',padding:'2rem',maxWidth:'40rem',margin:'0 auto'}}><h1>{recargando?'Recargando…':'No pudimos abrir esta página'}</h1><p role="alert">{chunk?'La aplicación se actualizó mientras la tenías abierta. Recarga la página para continuar.':'No se pudo confirmar el estado del servicio. No se ha confirmado ninguna operación desde esta pantalla.'}</p>{!recargando&&<button type="button" onClick={reintentar}>{chunk?'Recargar la página':'Volver a intentar'}</button>}</body></html>;
}
