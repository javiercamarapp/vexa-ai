import {createTransports} from './transports.mjs';
import {closeNotificationTransports} from './daemon.mjs';

/** Configuration readiness only; never probes a provider or asserts delivery. */
export async function configuredChannels(env=process.env){
 const transports=await createTransports(env);
 try{
  const readiness={inapp:true,email:false,push:false};
  for(const key of ['email','push'])readiness[key]=await transports[key]?.configured()===true;
  return readiness;
 }finally{await closeNotificationTransports(transports);}
}
