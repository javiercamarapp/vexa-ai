'use client';
import {useEffect,useState} from 'react';
import {useRecuperacionChunk} from '../components/ui/recuperar-chunk';
import {COOKIE_IDIOMA,IDIOMA_POR_OMISION,resolverIdioma,traducir,type Idioma} from '../lib/i18n';
/** Idioma en el navegador cuando no hay proveedor (falló el layout raíz): ?lang= o cookie rovaq_lang, como en el resto de la app. */
function idiomaDelNavegador():Idioma{
 try{const cookie=document.cookie.split('; ').find(c=>c.startsWith(COOKIE_IDIOMA+'='))?.slice(COOKIE_IDIOMA.length+1);return resolverIdioma({parametro:new URLSearchParams(window.location.search).get('lang'),cookie});}
 catch{return IDIOMA_POR_OMISION;}
}
/** Último recurso (falla el layout raíz): misma recuperación de ChunkLoadError, sin depender de estilos ni de componentes del layout (logo como imagen estática). */
export default function GlobalError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 const {chunk,recargando,reintentar}=useRecuperacionChunk(error,reset);
 // En el servidor no hay cookie: se pinta en el idioma por omisión y se ajusta al montar (esta pantalla es de último recurso, casi nunca se ve).
 const [idioma,setIdioma]=useState<Idioma>(IDIOMA_POR_OMISION);
 useEffect(()=>{setIdioma(idiomaDelNavegador());},[]);
 const t=(clave:Parameters<typeof traducir>[1])=>traducir(idioma,clave);
 return <html lang={idioma}><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="robots" content="noindex, nofollow"/><meta name="color-scheme" content="light"/><title>{t('tr.err.titulo')+' · Rovaq AI'}</title></head><body style={{fontFamily:'system-ui,sans-serif',padding:'2rem',maxWidth:'40rem',margin:'0 auto',color:'#0E0E10'}}>
  {/* eslint-disable-next-line @next/next/no-img-element -- Fuera del layout raíz no hay estilos ni next/image: logo estático de public/brand. */}
  <img src="/brand/rovaq-logo-horizontal-positivo-600px.png" alt="Rovaq AI" width={160} height={45} style={{display:'block',marginBottom:'2rem'}}/>
  <h1>{recargando?t('tr.err.recargando'):t('tr.err.titulo')}</h1><p role="alert">{chunk?t('tr.err.chunk'):t('tr.err.sinConfirmar')}</p>{!recargando&&<button type="button" onClick={reintentar}>{chunk?t('tr.err.recargar'):t('comun.reintentar')}</button>} <a href="/overview" style={{marginLeft:'0.75rem',color:'inherit'}}>{t('det.irAHoy')}</a></body></html>;
}
