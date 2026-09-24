import {createHmac,randomBytes} from 'node:crypto';

// Process-local backpressure complements provider/edge limits; it is not a distributed quota.
export function createEmailAdmission(now:()=>number=()=>performance.now()){
 const key=randomBytes(32),recent=new Map<string,number>();let active=0,blockedUntil=0;
 return {reserve(email:string){
  const time=now();for(const [id,expires]of recent)if(expires<=time)recent.delete(id);
  const id=createHmac('sha256',key).update(email.trim().toLowerCase()).digest('hex');
  if(time<blockedUntil||active>=8||recent.has(id)||recent.size>=256)return null;
  recent.set(id,time+60000);active++;let finished=false;
  return {finish(unavailable=false){if(finished)return;finished=true;active--;if(unavailable)blockedUntil=Math.max(blockedUntil,now()+60000);}};
 }};
}
export const emailAdmission=createEmailAdmission();
