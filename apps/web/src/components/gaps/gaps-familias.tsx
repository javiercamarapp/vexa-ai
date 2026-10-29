'use client';
import type {BrechasVista} from '../../../../../packages/workspace-service/brechas.mjs';
import {useT} from '../i18n/proveedor';
import {textoAvance} from './gaps-modelo.mjs';
import '../dinero/dinero.css';

/** Barra de avance del análisis del histórico (role=progressbar). */
export function Avance({f}:{f:BrechasVista['familias']}){
 const t=useT(),p=f.progreso,val=p?.avancePct??null;
 return <div style={{display:'grid',gap:6}}>
  <div className="dg-mini" style={{['--cat' as string]:'var(--chart-7)'}} role="progressbar" aria-label={t('tr.brecha.avanceAria')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={val??undefined} aria-valuetext={textoAvance(f)}><i style={{width:`${val??0}%`,minWidth:val?2:0}}/></div>
  <p className="dg-nota">{textoAvance(f)}</p>
 </div>;
}

