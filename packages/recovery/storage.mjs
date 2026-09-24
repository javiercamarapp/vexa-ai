/** Uses the request's real authenticated Supabase client, never a service role. */
export function createRecoveryStorage({database,client}){
 const authorize=path=>database.transaction('retain',async s=>{if(s.role!=='owner'||typeof path!=='string'||!path.startsWith(s.tenantId+'/')||!(await s.query('SELECT public.retention_storage_authorized($1) AS ok',[path])).rows[0]?.ok)throw Object.assign(Error('storage_not_authorized'),{code:'42501'});});
 const bucket=client.storage.from('vexa-private');
 return {async remove(path){await authorize(path);const {error}=await bucket.remove([path]);if(error)throw Error('storage_remove_unavailable');await authorize(path);},async exists(path){await authorize(path);const {data,error}=await bucket.download(path);await authorize(path);if(error){if(String(error.statusCode??error.status)==='404')return false;throw Error('storage_verify_unavailable');}if(!data)throw Error('storage_verify_unavailable');return true;}};
}
