// Server-only dedicated Auth credentials. Never accepts a browser refresh token.
export function workerCredentials(env=process.env){
 if(typeof window!=='undefined')throw Error('SERVER_ONLY');
 for(const k of ['VEXA_SUPABASE_URL','VEXA_SUPABASE_ANON_KEY','VEXA_WORKER_EMAIL','VEXA_WORKER_PASSWORD','VEXA_WORKER_USER_ID'])if(!env[k])throw Error('WORKER_CONFIGURATION_REQUIRED');
 const base=new URL(env.VEXA_SUPABASE_URL);if(base.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(base.hostname))throw Error('AUTH_TLS_REQUIRED');
 let session,pending;
 async function authenticate(){
  const refreshing=!!session?.refresh_token;
  const response=await fetch(base.href.replace(/\/$/,'')+'/auth/v1/token?grant_type='+(refreshing?'refresh_token':'password'),{method:'POST',headers:{apikey:env.VEXA_SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify(refreshing?{refresh_token:session.refresh_token}:{email:env.VEXA_WORKER_EMAIL,password:env.VEXA_WORKER_PASSWORD}),signal:AbortSignal.timeout(8000),redirect:'error'});
  if(!response.ok){session=null;throw Object.assign(Error('WORKER_AUTH_UNAVAILABLE'),{status:503});}
  const data=await response.json();if(data.user?.id!==env.VEXA_WORKER_USER_ID||!data.access_token||!Number.isFinite(data.expires_in)){session=null;throw Error('WORKER_IDENTITY_MISMATCH');}
  session={...data,until:Date.now()+data.expires_in*1000};return session.access_token;
 }
 return {async token(){if(session&&session.until>Date.now()+60000)return session.access_token;if(!pending)pending=authenticate().finally(()=>{pending=null;});return pending;},invalidate(){session=null;}};
}
