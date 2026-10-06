/* VEXA: no application/identity caching; only opaque registration identity is read; notification content is ignored. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 event.waitUntil((async()=>{
  try{
   const payload=event.data?.json();
   if(!payload||typeof payload.subscriptionId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.subscriptionId)||!Number.isSafeInteger(payload.version)||payload.version<1)return;
   const response=await fetch('/api/notifications/push',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});
   if(!response.ok)return;
   const {data}=await response.json();
   if(!data?.configured||!data.devices?.some(d=>d.id===payload.subscriptionId&&d.version===payload.version&&d.deviceId===data.currentDeviceId&&d.status==='active'&&Date.parse(d.expiresAt)>Date.now()))return;
   await self.registration.showNotification('Rovaq AI',{body:'Tienes avisos disponibles en Rovaq AI.',tag:'vexa-notifications',data:{href:'/notifications'}});
  }catch{/* Fail closed: no session or verified active subscription. */}
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 // Never use a destination from the notification payload. The page reauthorizes the current session.
 event.waitUntil(self.clients.openWindow(new URL('/notifications',self.location.origin).href));
});
self.addEventListener('pushsubscriptionchange',event=>{
 // Browser key rotation requires a new explicit registration in the authenticated preferences UI.
 event.waitUntil(Promise.resolve());
});
