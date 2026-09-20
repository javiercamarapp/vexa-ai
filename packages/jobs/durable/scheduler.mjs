// Local scheduler exercising exactly the hosted HTTP protocol. No tenant in request.
const env=process.env,url=new URL(env.VEXA_WORKER_ENDPOINT??'');
const interval=Number(env.VEXA_WORKER_INTERVAL_MS??30000);
if(url.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(url.hostname))throw Error('TLS_REQUIRED');
if(!env.VEXA_WORKER_TRIGGER_SECRET||interval<10000||interval>60000)throw Error('CONFIGURATION_REQUIRED');
let stop=false;process.on('SIGTERM',()=>{stop=true;});
do{const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+env.VEXA_WORKER_TRIGGER_SECRET},signal:AbortSignal.timeout(55000),redirect:'error'});console.log('worker_http_status='+response.status);if(process.argv.includes('--once'))break;await new Promise(r=>setTimeout(r,interval));}while(!stop);
