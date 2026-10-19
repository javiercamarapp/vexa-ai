'use client';
import Link from 'next/link';
export default function ErrorPage({reset}:{reset:()=>void}){return <section className="access-flow"><p className="eyebrow">Rovaq AI</p><h1>No pudimos abrir esta página</h1><p role="alert">No se pudo confirmar el estado del servicio. Vuelve a intentarlo; no se ha confirmado ninguna operación desde esta pantalla.</p><div className="btn-group"><button type="button" className="btn btn-primary" onClick={reset}>Volver a intentar</button><Link className="btn btn-secondary" href="/">Volver al inicio</Link></div></section>;}
