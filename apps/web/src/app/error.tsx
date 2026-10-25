'use client';
import Link from 'next/link';
import {useRecuperacionChunk} from '../components/ui/recuperar-chunk';
export default function ErrorPage({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 const {chunk,recargando,reintentar}=useRecuperacionChunk(error,reset);
 if(recargando)return <section className="access-flow" role="status" aria-live="polite"><p className="eyebrow">Rovaq AI</p><h1>Recargando…</h1><p>Hay una versión nueva de la aplicación. Recargamos la página para abrirla.</p></section>;
 return <section className="access-flow"><p className="eyebrow">Rovaq AI</p><h1>No pudimos abrir esta página</h1><p role="alert">{chunk?'La aplicación se actualizó mientras la tenías abierta. Recarga la página para continuar; no se ha confirmado ninguna operación desde esta pantalla.':'No se pudo confirmar el estado del servicio. Vuelve a intentarlo; no se ha confirmado ninguna operación desde esta pantalla.'}</p><div className="btn-group"><button type="button" className="btn btn-primary" onClick={reintentar}>{chunk?'Recargar la página':'Volver a intentar'}</button><Link prefetch={false} className="btn btn-secondary" href="/overview">Ir a Hoy</Link></div></section>;
}
