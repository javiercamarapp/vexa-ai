import {canonicalPorts} from './canonical-ports.mjs';
import {serve} from './runtime.mjs';
import {productBinding} from './product-binding.mjs';
import path from 'node:path';
let app,ports;
process.on('message',async message=>{
 try{
  if(message.type==='start'){
   ports=await canonicalPorts(message.config);
   const handler=message.entry.endsWith('/packages/jobs/index.mjs')?await productBinding(path.resolve(message.entry,'../../..'),ports):await (await import(message.entry)).createImportHandler(ports,{defect:process.env.F02_ORACLE_DEFECT});
   app=await serve(handler);process.send({type:'ready',origin:app.origin,pid:process.pid});
  }else if(message.type==='close'){await app?.close();ports?.close();process.exit(0);}
 }catch{process.send({type:'error',code:'HTTP_CHILD_START_FAILED'});process.exit(1);}
});
