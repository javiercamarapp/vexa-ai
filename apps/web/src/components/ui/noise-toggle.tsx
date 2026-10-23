'use client';
import {nf} from './format';
import s from './legibilidad.module.css';
/** Interruptor «Incluir notificaciones automáticas» + contador de lo oculto. Solo cambia la presentación: no toca datos guardados. */
export function NoiseToggle({incluir,onChange,ocultos,unidad='elementos'}:{incluir:boolean;onChange:(v:boolean)=>void;ocultos:number;unidad?:string}){
 return <div className={s.noiseBar}>
  <label className={s.switch}><input type="checkbox" role="switch" checked={incluir} onChange={e=>onChange(e.target.checked)}/><span className={s.track} aria-hidden="true"/><span>Incluir notificaciones automáticas</span></label>
  <span className={s.noiseCount} role="status" aria-live="polite">{incluir?'Incluye alertas de minoristas y del sistema':ocultos>0?`${nf.format(ocultos)} ${ocultos===1?'automática oculta':'automáticas ocultas'} · ${unidad}`:'Ninguna oculta en esta vista'}</span>
 </div>;
}
