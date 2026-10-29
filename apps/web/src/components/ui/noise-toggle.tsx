'use client';
import {useT} from '../i18n/proveedor';
import {nf} from './format';
import s from './legibilidad.module.css';
/** Interruptor «Incluir notificaciones automáticas» + contador de lo oculto. Solo cambia la presentación: no toca datos guardados. */
export function NoiseToggle({incluir,onChange,ocultos,unidad}:{incluir:boolean;onChange:(v:boolean)=>void;ocultos:number;unidad?:string}){
 const t=useT(),und=unidad??t('tr.ui.elementos');
 return <div className={s.noiseBar}>
  <label className={s.switch}><input type="checkbox" role="switch" checked={incluir} onChange={e=>onChange(e.target.checked)}/><span className={s.track} aria-hidden="true"/><span>{t('tr.ui.ruidoIncluir')}</span></label>
  <span className={s.noiseCount} role="status" aria-live="polite">{incluir?t('tr.ui.ruidoIncluye'):ocultos>0?t(ocultos===1?'tr.ui.ruidoUna':'tr.ui.ruidoVarias',{n:nf.format(ocultos),unidad:und}):t('tr.ui.ruidoNinguna')}</span>
 </div>;
}
