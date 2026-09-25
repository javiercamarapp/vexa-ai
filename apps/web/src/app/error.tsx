'use client';
import Link from 'next/link';
export default function ErrorPage({reset}:{reset:()=>void}){return <section className="access-flow"><p className="eyebrow">VEXA AI</p><h1>No pudimos abrir esta página</h1><p role="alert">No se pudo confirmar el estado del servicio. Vuelve a intentarlo; no se ha confirmado ninguna operación desde esta pantalla.</p><button type="button" onClick={reset}>Volver a intentar</button><Link href="/">Volver al inicio</Link></section>;}
