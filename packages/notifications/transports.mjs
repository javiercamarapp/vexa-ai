import {createTransports as emailTransports} from './email.mjs';
import {createTransports as pushTransports} from './push-config.mjs';

/** Built-in deployment wiring: operators provide configuration, not new code. */
export async function createTransports(env=process.env,runtimeOptions={}){
 const email=await emailTransports(env);
 try{return {...email,...await pushTransports(env,runtimeOptions)};}
 catch(error){await Promise.allSettled(Object.values(email).map(transport=>transport.close?.()));throw error;}
}
