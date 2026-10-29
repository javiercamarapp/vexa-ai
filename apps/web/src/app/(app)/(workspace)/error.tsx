'use client';
import {EmptyState} from '../../../components/ui/empty-state';
import {useRecuperacionChunk} from '../../../components/ui/recuperar-chunk';
import {useT} from '../../../components/i18n/proveedor';
export default function ErrorPage({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 const t=useT();
 const {chunk,recargando,reintentar}=useRecuperacionChunk(error,reset);
 if(recargando)return <section role="status" aria-live="polite"><h1 className="sr-only">{t('tr.ge.vistaActualizando')}</h1><EmptyState tone="neutral" art="shield" title={t('tr.err.recargando')} body={t('tr.err.versionNueva')}/></section>;
 return <section role="alert"><h1 className="sr-only">{t('tr.ge.vistaTitulo')}</h1><EmptyState tone="warn" art="shield" title={t('tr.ge.vistaTitulo')} body={chunk?t('tr.ge.vistaChunk'):t('tr.ge.vistaConsulta')} action={<button type="button" className="btn btn-primary btn-sm" onClick={reintentar}>{chunk?t('tr.err.recargar'):t('tr.ge.reintentar')}</button>}/></section>;
}
