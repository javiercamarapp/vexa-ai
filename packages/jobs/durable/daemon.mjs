import {consumeOne} from './consumer.mjs';
import {pagesFromStorage} from './records.mjs';
import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
function isEntry(){try{return !!process.argv[1]&&realpathSync(process.argv[1])===realpathSync(fileURLToPath(import.meta.url));}catch{return false;}}
export async function runDaemon({repository,storage,close=async()=>{}},{signal,once=false,afterCommit}={}){
 try{do{await repository.heartbeat();try{await consumeOne({repository,pages:async(j,cp,options)=>pagesFromStorage(storage,await repository.source(j),cp,options),afterCommit});}catch(e){if(e.status===401||e.status===403)throw e;console.error('Chunk deferred; durable state retained.');}if(once)break;await new Promise(r=>{const timer=setTimeout(done,1000);function done(){clearTimeout(timer);signal?.removeEventListener('abort',done);r();}signal?.addEventListener('abort',done,{once:true});});}while(!signal?.aborted);}finally{await close();}
}
if(isEntry()){const controller=new AbortController();process.once('SIGTERM',()=>controller.abort());process.once('SIGINT',()=>controller.abort());try{const {createRuntime}=await import('./runtime.mjs');await runDaemon(await createRuntime(),{signal:controller.signal,once:process.argv.includes('--once')});}catch{console.error('Consumer unavailable: verify documented Auth, SQL, Storage configuration.');process.exitCode=1;}}
