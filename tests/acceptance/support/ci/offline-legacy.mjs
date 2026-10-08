// These handlers intentionally sanitize even missing Auth configuration to their
// existing error envelopes. This exception is only for the unconfigured build
// smoke, never evidence of backend readiness. The caller must prove the build
// and server have no effective Auth configuration before enabling offline mode.
const profiles=new Map([
 ['/api/notifications/push',{code:'push_request_failed',message:'No se pudo verificar la suscripción.',push:true}],
 ['/api/notifications/delivery',{code:'delivery_policy_unavailable',message:'No se pudo verificar la política de envío con tus permisos actuales.'}],
 ['/api/candidates',{code:'candidates_unavailable',message:'No se pudo completar la gestión de candidatos.'}],
 ['/api/history',{code:'history_unavailable'}],
 ['/api/recovery',{code:'retention_unavailable'}],
 ['/api/evaluation',{code:'evaluation_configuration_required'}],
 ['/api/platform',{code:'platform_configuration_required'}],
]);
function exactKeys(value,keys){return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));}
export function isOfflineLegacyResponse({offline,required,method,url,status,contentType,cache,envelope}){
 if(offline!==true||required||method!=='GET'||url.search||status!==503||!/^application\/json(?:;|$)/i.test(contentType))return false;
 if(!/(?:^|,)\s*private\s*(?:,|$)/i.test(cache)||!/(?:^|,)\s*no-store\s*(?:,|$)/i.test(cache)||/(?:^|,)\s*public\s*(?:,|$)/i.test(cache))return false;
 const profile=profiles.get(url.pathname);if(!profile)return false;
 if(!exactKeys(envelope,profile.push?['error','meta']:['error']))return false;
 const keys=['code',...(profile.message?['message']:[]),...(profile.push?['retryable']:[])];
 if(!exactKeys(envelope.error,keys)||envelope.error.code!==profile.code)return false;
 if(profile.message&&envelope.error.message!==profile.message)return false;
 if(profile.push&&(!exactKeys(envelope.meta,['trace_id'])||typeof envelope.meta.trace_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(envelope.meta.trace_id)||envelope.error.retryable!==true))return false;
 return true;
}
