'use client';
import Link from '../workspace/navigation-lifecycle';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {WorkspaceIcon} from '../workspace/icon';
import {useT} from '../i18n/proveedor';

export function NotificationNavigationLink({compact=false}:{compact?:boolean}){
 const pathname=usePathname(),t=useT();const [count,setCount]=useState<number|null>(null);
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
 return <Link className={compact?'notification-bell':undefined} href="/notifications" aria-label={t('shell.notificaciones')} aria-current={pathname==='/notifications'?'page':undefined} title={count===null?t('shell.notificaciones'):t('shell.avisosSinLeer',{n:count})}><WorkspaceIcon name="notifications"/><span className={compact?'sr-only':'nav-label'}>{t('shell.notificaciones')}</span>{count!==null&&count>0&&<span aria-label={t('shell.avisosSinLeer',{n:count})} className="notification-count">{count}</span>}</Link>;
}
