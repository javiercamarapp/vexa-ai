/** Uses the request's real authenticated Supabase client, never a service role. */
export function createRecoveryStorage({database,client}){
 const authorize=path=>database.transaction('retain',async s=>{if(s.role!=='owner'||typeof path!=='string'||!path.startsWith(s.tenantId+'/')||!(await s.query('SELECT public.retention_storage_authorized($1) AS ok',[path])).rows[0]?.ok)throw Object.assign(Error('storage_not_authorized'),{code:'42501'});});
 const bucket=client.storage.from('vexa-private');
 return {async remove(path){await authorize(path);const {error}=await bucket.remove([path]);if(error)throw Error('storage_remove_unavailable');await authorize(path);},async exists(path){await authorize(path);const rows=await database.transaction('retain',async s=>(await s.query('SELECT public.retention_storage_object_exists($1) AS present',[path])).rows);await authorize(path);if(rows.length!==1||typeof rows[0]?.present!=='boolean')throw Error('storage_verify_unavailable');return rows[0].present;}};
}
