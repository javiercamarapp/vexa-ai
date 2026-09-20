// Adapter for the authored product ports. No admin SQL, legacy repository or mock.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
export async function productBinding(candidate,ports) {
 const entry=path.join(candidate,'packages/jobs/index.mjs');
 const module=await import(pathToFileURL(entry));
 assert.equal(typeof module.createImportHandler,'function','PRODUCT_PORT_MISSING: createImportHandler (present in authored F02-02 proposal)');
 return request=>module.createImportHandler({
  database:ports.database(request),confirmationSecret:ports.signingSecret,
  storage:{
   async createUpload(scope,row){
    const result=await ports.storage('/object/upload/sign/vexa-private/'+row.object_path,request.headers.get('authorization')?.replace(/^Bearer /,''),{method:'POST',body:{}});
    if(result.status!==200)throw new ports.AccessError(503,'storage_sign_unavailable');
    return {url:result.data.url};
   },
   async read(scope,row){
    const result=await ports.storage('/object/authenticated/vexa-private/'+row.object_path,request.headers.get('authorization')?.replace(/^Bearer /,''));
    if(result.status!==200)throw new ports.AccessError(503,'storage_read_unavailable');
    return result.bytes;
   }
  }
 })(request);
}
