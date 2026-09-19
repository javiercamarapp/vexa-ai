'use client';
import { useEffect } from 'react';
/** A BFCache restoration must revalidate on the server before showing private content. */
export function SessionGuard() {
  useEffect(()=>{
    const hide=()=>{document.documentElement.style.visibility='hidden';};
    const show=(event:PageTransitionEvent)=>{if(event.persisted)window.location.reload();else document.documentElement.style.visibility='';};
    window.addEventListener('pagehide',hide);window.addEventListener('pageshow',show);
    return ()=>{window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',show);document.documentElement.style.visibility='';};
  },[]);
  return null;
}
