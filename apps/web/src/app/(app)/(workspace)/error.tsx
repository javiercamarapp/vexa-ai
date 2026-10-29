'use client';
import {EmptyState} from '../../../components/ui/empty-state';
import {useRecuperacionChunk} from '../../../components/ui/recuperar-chunk';
export default function ErrorPage({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 const {chunk,recargando,reintentar}=useRecuperacionChunk(error,reset);
 if(recargando)return <section role="status" aria-live="polite"><h1 className="sr-only">Actualizando la vista</h1><EmptyState tone="neutral" art="shield" title="Recargando…" body="Hay una versión nueva de la aplicación. Recargamos la página para abrirla."/></section>;
 return <section role="alert"><h1 className="sr-only">Vista no disponible</h1><EmptyState tone="warn" art="shield" title="Vista no disponible" body={chunk?'La aplicación se actualizó mientras la tenías abierta y no pudo cargar esta parte. Recarga la página para continuar; no se han sustituido los datos por ceros.':'No se pudo completar la consulta. No se han sustituido los datos por ceros.'} action={<button type="button" className="btn btn-primary btn-sm" onClick={reintentar}>{chunk?'Recargar la página':'Reintentar'}</button>}/></section>;
}
