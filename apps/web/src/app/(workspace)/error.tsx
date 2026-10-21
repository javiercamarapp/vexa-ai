'use client';
import {EmptyState} from '../../components/ui/empty-state';
export default function ErrorPage({reset}:{reset:()=>void}){return <section role="alert"><h1 className="sr-only">Vista no disponible</h1><EmptyState tone="warn" art="shield" title="Vista no disponible" body="No se pudo completar la consulta. No se han sustituido los datos por ceros." action={<button type="button" className="btn btn-primary btn-sm" onClick={reset}>Reintentar</button>}/></section>;}
