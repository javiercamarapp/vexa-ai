import {pathToFileURL} from 'node:url';import path from 'node:path';
process.once('message',async({connection,actor:a,request})=>{let pool;try{
 const {default:pg}=await import(pathToFileURL(process.env.F03_PG));pool=new pg.Pool(connection);
 const {createDatabase}=await import(pathToFileURL(path.join(process.env.F03_BUILD,'packages/platform/db.mjs')));
 const sync=await import(pathToFileURL(path.join(process.env.F03_BUILD,'packages/connectors/sync.mjs')));
 const identity={async getUser(){return{id:a.id};},async memberships(){return[{tenant_id:a.tenant,user_id:a.id,role:a.role,status:'active',permissions_version:1}];}};
 const repository=sync.createSyncRepository({database:createDatabase({identity,pool,selectedTenant:a.tenant})});
 let result;if(request.op==='run'){const {adapter}=await import('./fixtures.mjs');result=await sync.runSync({...request.args,repository,adapterFactory:async()=>adapter(request.pages)});}else result=await repository[request.op](request.args);process.send({ok:true,result});
 }catch(e){process.send({ok:false,code:e.code??e.message});}finally{if(pool)await pool.end();process.disconnect();}});
