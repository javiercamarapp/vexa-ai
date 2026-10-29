'use client';
import Link from 'next/link';
import {useT} from '../../components/i18n/proveedor';
import {useRecuperacionChunk} from '../../components/ui/recuperar-chunk';
export default function ErrorPage({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 const t=useT();
 const {chunk,recargando,reintentar}=useRecuperacionChunk(error,reset);
 if(recargando)return <section className="access-flow" role="status" aria-live="polite"><p className="eyebrow">Rovaq AI</p><h1>{t('tr.err.recargando')}</h1><p>{t('tr.err.versionNueva')}</p></section>;
 return <section className="access-flow"><p className="eyebrow">Rovaq AI</p><h1>{t('tr.err.titulo')}</h1><p role="alert">{chunk?t('tr.err.chunk'):t('tr.err.sinConfirmar')}</p><div className="btn-group"><button type="button" className="btn btn-primary" onClick={reintentar}>{chunk?t('tr.err.recargar'):t('comun.reintentar')}</button><Link prefetch={false} className="btn btn-secondary" href="/overview">{t('det.irAHoy')}</Link></div></section>;
}
