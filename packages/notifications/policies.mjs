import {check} from './contracts.mjs';
import {validatePolicy} from './delivery.mjs';

/** Management uses the existing authenticated database boundary, never a service key. */
export function createDeliveryPolicyRepository({database}) {
 check(typeof database?.transaction==='function','notification_database_missing',503);
 return Object.freeze({
  async list() {
   return database.transaction('read',async scope=>{
    check(scope.role==='owner','notification_owner_required',403);
    const {rows}=await scope.query('SELECT DISTINCT ON(channel) channel,version,enabled,interval_ms,digest_window_ms,max_attempts,lifetime_ms FROM public.notification_delivery_policies WHERE tenant_id=$1 ORDER BY channel,version DESC',[scope.tenantId]);
    return ['inapp','email','push'].map(channel=>{
     const row=rows.find(value=>value.channel===channel);
     return row?{channel,version:row.version,enabled:row.enabled,intervalMs:row.interval_ms,digestWindowMs:row.digest_window_ms,maxAttempts:row.max_attempts,lifetimeMs:Number(row.lifetime_ms)}:{channel,version:0,enabled:false,intervalMs:60000,digestWindowMs:0,maxAttempts:3,lifetimeMs:86400000};
    });
   });
  },
  async save(input) {
   const value=validatePolicy(input);
   return database.transaction('configure',async scope=>{
    check(scope.role==='owner','notification_owner_required',403);
    const {rows}=await scope.query('SELECT public.notification_policy_set($1::jsonb) AS value',[JSON.stringify(value)]);
    return {channel:value.channel,version:rows[0].value.version};
   });
  },
 });
}
