const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x);
/** Uses the existing membership/worker-delegation SQL boundary. No service-role writes. */
export function createCRMWebhookRepository({database}){
 return Object.freeze({async record({binding,digest}){
  if(!binding||!uuid(binding.tenantId)||!uuid(binding.connectionId)||!['hubspot','zendesk'].includes(binding.source)||typeof binding.accountId!=='string'||!/^[a-f0-9]{64}$/.test(digest))throw Error('CRM_WEBHOOK_INPUT_INVALID');
  return database.transaction('import',async s=>{
   if(s.tenantId!==binding.tenantId)return {status:'unavailable'};
   // Serialize admission with configuration, another webhook and consumer completion.
   const row=(await s.query(`SELECT r.id,r.failure_count,c.source,c.account_id,coalesce(h.state,'unknown') AS health
    FROM public.crm_sync_settings r JOIN public.connections c ON c.tenant_id=r.tenant_id AND c.id=r.connection_id
    LEFT JOIN public.connection_health h ON h.tenant_id=r.tenant_id AND h.connection_id=r.connection_id
    WHERE r.tenant_id=$1 AND r.connection_id=$2 AND public.crm_actor_authorized(r.connection_id)
    FOR UPDATE OF r`,[s.tenantId,binding.connectionId])).rows[0];
   if(!row||row.source!==binding.source||row.account_id!==binding.accountId)return {status:'unavailable'};
   const args=[s.tenantId,binding.connectionId];
   await s.query("DELETE FROM public.crm_webhook_receipts WHERE tenant_id=$1 AND connection_id=$2 AND received_at<clock_timestamp()-interval '10 minutes'",args);
   const duplicate=(await s.query('SELECT id FROM public.crm_webhook_receipts WHERE tenant_id=$1 AND connection_id=$2 AND digest=$3',[...args,digest])).rows[0];
   if(duplicate)return {status:'duplicate'};
   const recent=(await s.query("SELECT count(*)::int AS n FROM public.crm_webhook_receipts WHERE tenant_id=$1 AND connection_id=$2 AND received_at>clock_timestamp()-interval '1 minute'",args)).rows[0];
   if(recent.n>=60)return {status:'rate_limited'};
   await s.query('INSERT INTO public.crm_webhook_receipts(tenant_id,connection_id,digest) VALUES($1,$2,$3)',[...args,digest]);
   if(row.failure_count===0&&row.health!=='reconnect_required')await s.query("UPDATE public.crm_sync_settings SET next_attempt_at=least(next_attempt_at,greatest(clock_timestamp(),coalesce(last_dispatched_at+interval '30 seconds',clock_timestamp()))),updated_at=clock_timestamp() WHERE tenant_id=$1 AND connection_id=$2",args);
   return {status:'accepted'};
  });
 }});
}
