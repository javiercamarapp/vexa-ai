'use client';
import NextLink from 'next/link';
import {useEffect,type ComponentProps} from 'react';

const navigationEvent='rovaq:workspace-navigation';
type Props=Omit<ComponentProps<typeof NextLink>,'href'> & {href:string};

// Next calls onNavigate only for an uncancelled client navigation: modified
// clicks, external destinations and downloads keep their ordinary behavior.
export default function WorkspaceLink({href,onNavigate,...props}:Props){
 return <NextLink {...props} href={href} onNavigate={event=>{
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
