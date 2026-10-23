'use client';
import NextLink from 'next/link';
import {useSearchParams} from 'next/navigation';
import {useEffect,type ComponentProps} from 'react';
import {hrefConAlcance} from '../../lib/workspace/alcance.mjs';

const navigationEvent='rovaq:workspace-navigation';
type Props=Omit<ComponentProps<typeof NextLink>,'href'> & {href:string};

// Next calls onNavigate only for an uncancelled client navigation: modified
// clicks, external destinations and downloads keep their ordinary behavior.
export default function WorkspaceLink({href:crudo,onNavigate,...props}:Props){
 // Un enlace interno sin query conserva el alcance de la pantalla (periodo y corte), igual que el menú.
 const href=hrefConAlcance(crudo,useSearchParams().toString());
 // Sin precarga automática de Next: cada pantalla del menú pide sesión y datos al servidor, y precargar las ~17 a la vez saturaba el pool de la base (503).
 // El calentamiento de datos lo hace `precalentar.mjs` (tope de 2 peticiones, al pasar el cursor o en inactividad). Una pantalla puede reactivarla pasando `prefetch`.
 return <NextLink prefetch={false} {...props} href={href} onNavigate={event=>{
  let cancelled=false;
  onNavigate?.({preventDefault:()=>{cancelled=true;event.preventDefault();}});
  if(cancelled)return;
  const target=new URL(href,window.location.href);
  if(target.origin===window.location.origin&&target.pathname+target.search!==window.location.pathname+window.location.search){
   window.dispatchEvent(new Event(navigationEvent));
  }
 }}/>;
}

// Abort before the router commits its destination. A late history.replaceState
// from the old page would otherwise supersede the pending client navigation.
export function useWorkspaceNavigation(invalidate:()=>void){
 useEffect(()=>{
  window.addEventListener(navigationEvent,invalidate);
  return()=>window.removeEventListener(navigationEvent,invalidate);
 },[invalidate]);
}
export function workspaceLocation(){return window.location.pathname+window.location.search;}
