'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';

export function NotificationNavigationLink(){
 const pathname=usePathname();const [count,setCount]=useState<number|null>(null);
 useEffect(()=>{
  let current=true,generation=0;let request:AbortController|undefined;
  const refresh=async()=>{
   request?.abort();const controller=new AbortController();request=controller;const version=++generation;
   try{const response=await fetch('/api/notifications?status=unread&limit=1',{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error();const result=await response.json();if(result?.contract_version!=='f06-notifications-v1'||!Number.isSafeInteger(result.data?.unreadCount)||result.data.unreadCount<0)throw Error();if(current&&version===generation)setCount(result.data.unreadCount);}
   catch{if(current&&version===generation)setCount(null);}
  };
  const refreshVisible=()=>{if(document.visibilityState==='visible')void refresh();};
  void refresh();window.addEventListener('vexa-notifications-changed',refreshVisible);window.addEventListener('focus',refreshVisible);document.addEventListener('visibilitychange',refreshVisible);
  return()=>{current=false;request?.abort();window.removeEventListener('vexa-notifications-changed',refreshVisible);window.removeEventListener('focus',refreshVisible);document.removeEventListener('visibilitychange',refreshVisible);};
 },[pathname]);
 return <Link href="/notifications" aria-label="Notificaciones" aria-current={pathname==='/notifications'||pathname==='/settings/notifications'?'page':undefined} title={count===null?'Notificaciones':`${count} avisos sin leer`}>Notificaciones{count!==null&&count>0&&<span aria-label={`${count} avisos sin leer`} style={{marginLeft:'.5rem',fontWeight:700}}>{count}</span>}</Link>;
}
