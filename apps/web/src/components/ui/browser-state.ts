'use client';
import {useSyncExternalStore} from 'react';
const subscribeHydration=()=>()=>{};
const clientSnapshot=()=>true;
const serverSnapshot=()=>false;
/** SSR and hydration agree; browser-only portals appear after hydration. */
export function useHydrated(){return useSyncExternalStore(subscribeHydration,clientSnapshot,serverSnapshot);}
const reducedQuery='(prefers-reduced-motion: reduce)';
const reducedSnapshot=()=>window.matchMedia?.(reducedQuery).matches??false;
const subscribeReduced=(notify:()=>void)=>{const mq=window.matchMedia?.(reducedQuery);mq?.addEventListener('change',notify);return()=>mq?.removeEventListener('change',notify);};
export function useReducedMotion(){return useSyncExternalStore(subscribeReduced,reducedSnapshot,serverSnapshot);}
const hashSnapshot=()=>window.location.hash.replace('#','');
const serverHash=()=>'';
const subscribeHash=(notify:()=>void)=>{window.addEventListener('hashchange',notify);return()=>window.removeEventListener('hashchange',notify);};
export function useLocationHash(){return useSyncExternalStore(subscribeHash,hashSnapshot,serverHash);}

const storageEvent='rovaq:preference-changed';
const sessionValues=new Map<string,string>();
const subscribeStorage=(notify:()=>void)=>{window.addEventListener('storage',notify);window.addEventListener(storageEvent,notify);return()=>{window.removeEventListener('storage',notify);window.removeEventListener(storageEvent,notify);};};
/** A browser preference is an external store; unavailable storage stays session-local. */
export function useStoredString(key:string,fallback:string){
 const read=()=>{if(sessionValues.has(key))return sessionValues.get(key)!;try{return window.localStorage.getItem(key)??fallback;}catch{return fallback;}};
 const value=useSyncExternalStore(subscribeStorage,read,()=>fallback);
 const write=(next:string)=>{try{window.localStorage.setItem(key,next);sessionValues.delete(key);}catch{sessionValues.set(key,next);}window.dispatchEvent(new Event(storageEvent));};
 return [value,write] as const;
}
