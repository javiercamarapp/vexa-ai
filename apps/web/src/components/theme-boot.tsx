'use client';
import {useEffect} from 'react';
/** Páginas fuera del espacio de trabajo (p. ej. 404) no montan el shell que aplica el tema: leen la misma preferencia guardada («vexa-theme») y respetan el sistema. */
export function ThemeBoot(){
 useEffect(()=>{
  let stored='system';try{stored=window.localStorage.getItem('vexa-theme')??'system';}catch{/* La preferencia es opcional. */}
  const media=window.matchMedia('(prefers-color-scheme: dark)');
  const apply=()=>{document.documentElement.dataset.theme=stored==='dark'||(stored!=='light'&&media.matches)?'dark':'light';};
  apply();media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply);
 },[]);
 return null;
}
