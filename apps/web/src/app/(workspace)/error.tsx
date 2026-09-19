'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <section role="alert"><h1>Vista no disponible</h1><p>No se pudo completar la consulta. No se han sustituido los datos por ceros.</p><button onClick={reset}>Reintentar</button></section>;}
