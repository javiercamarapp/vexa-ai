// Control-only transport observer. Never injects business responses or credentials.
import fs from 'node:fs';
const journal=process.env.VEXA_RECOMMENDATION_AUDIT;
if(journal){
 const original=globalThis.fetch;
 globalThis.fetch=async function(input,init){
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  const local=['127.0.0.1','localhost','[::1]','::1'].includes(url.hostname);
  fs.appendFileSync(journal,JSON.stringify({method:init?.method??((typeof input==='object'&&input.method)||'GET'),origin:url.origin,path:url.pathname,blocked:!local})+'\n',{mode:0o600});
  if(!local)throw Error('CONTROL_EXTERNAL_TRANSPORT_BLOCKED');
  return original.call(this,input,init);
 };
}
