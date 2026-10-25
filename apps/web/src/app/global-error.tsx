'use client';
import {useRecuperacionChunk} from '../components/ui/recuperar-chunk';
/** Último recurso (falla el layout raíz): misma recuperación de ChunkLoadError, sin depender de estilos ni de componentes del layout (logo como imagen estática). */
export default function GlobalError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 const {chunk,recargando,reintentar}=useRecuperacionChunk(error,reset);
 return <html lang="es"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="robots" content="noindex, nofollow"/><meta name="color-scheme" content="light"/><title>No pudimos abrir esta página · Rovaq AI</title></head><body style={{fontFamily:'system-ui,sans-serif',padding:'2rem',maxWidth:'40rem',margin:'0 auto',color:'#0E0E10'}}>
  {/* eslint-disable-next-line @next/next/no-img-element -- Fuera del layout raíz no hay estilos ni next/image: logo estático de public/brand. */}
  <img src="/brand/rovaq-logo-horizontal-positivo-600px.png" alt="Rovaq AI" width={160} height={45} style={{display:'block',marginBottom:'2rem'}}/>
  <h1>{recargando?'Recargando…':'No pudimos abrir esta página'}</h1><p role="alert">{chunk?'La aplicación se actualizó mientras la tenías abierta. Recarga la página para continuar.':'No se pudo confirmar el estado del servicio. No se ha confirmado ninguna operación desde esta pantalla.'}</p>{!recargando&&<button type="button" onClick={reintentar}>{chunk?'Recargar la página':'Volver a intentar'}</button>} <a href="/overview" style={{marginLeft:'0.75rem',color:'inherit'}}>Ir a Hoy</a></body></html>;
}
