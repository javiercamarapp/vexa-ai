'use client';
import {useEffect,useState} from 'react';
export type TemaChat='global'|'light'|'dark'|'system';
const CLAVE='vexa-chat-theme',GLOBAL='vexa-theme';
const leer=(k:string):string|null=>{try{return window.localStorage.getItem(k);}catch{return null;}};
/** Tema efectivo de una preferencia («system» sigue al sistema). */
export const temaEfectivo=(pref:string|null,sistemaOscuro:boolean):'light'|'dark'=>pref==='dark'||(pref!=='light'&&sistemaOscuro)?'dark':'light';
/** Tema propio del chat: lo aplica solo mientras el chat está abierto y NO toca la preferencia global («vexa-theme»). Con «global» el chat sigue a la del resto del producto. */
export function ThemeToggle(){
 const [pref,setPref]=useState<TemaChat>('global');
 useEffect(()=>{const v=leer(CLAVE);if(v==='light'||v==='dark'||v==='system'){const f=requestAnimationFrame(()=>setPref(v));return()=>cancelAnimationFrame(f);}},[]);
 useEffect(()=>{
  if(pref==='global')return;
  const media=window.matchMedia('(prefers-color-scheme: dark)');
  const apply=()=>{document.documentElement.dataset.theme=temaEfectivo(pref,media.matches);};
  apply();media.addEventListener('change',apply);
  return()=>{media.removeEventListener('change',apply);document.documentElement.dataset.theme=temaEfectivo(leer(GLOBAL),media.matches);};
 },[pref]);
 const elegir=(v:TemaChat)=>{setPref(v);try{if(v==='global')window.localStorage.removeItem(CLAVE);else window.localStorage.setItem(CLAVE,v);}catch{/* La preferencia es opcional. */}};
 return <label className="chat-theme" title="Solo cambia este chat; la preferencia general de la aplicación no se modifica.">
  <span className="sr-only">Tema de este chat</span>
  <select value={pref} onChange={e=>elegir(e.target.value as TemaChat)} aria-label="Tema de este chat">
   <option value="global">Tema: como la aplicación</option><option value="light">Tema: claro</option><option value="dark">Tema: oscuro</option><option value="system">Tema: del sistema</option>
  </select>
 </label>;
}
