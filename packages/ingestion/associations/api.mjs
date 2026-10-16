const fields={resolve:['factId','expectedVersion','evidenceHash','requestId','decision','targets','reason'],approve_origin:['approvalId','expectedVersion','requestId','manifestHash','entries','reason'],revoke_origin:['approvalId','expectedVersion','requestId','reason']};
const error=(code,status)=>Object.assign(new Error(code),{code,status});
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export function createAssociationsHandler(repository,{origin}={}){
 if(origin!==undefined){const configured=new URL(origin);if(typeof origin!=='string'||!['http:','https:'].includes(configured.protocol)||configured.origin!==origin)throw new TypeError('Invalid association origin');}
 return async request=>{try{
 const url=new URL(request.url);let data;
 if(request.method==='GET'){
  const view=url.searchParams.get('view')??'facts',spec={facts:['state','cursor','limit','conversationId','customerId'],fact:['factId','evidenceCursor','candidateCursor'],edges:['conversationId','customerId','cursor','limit','provenanceCursor'],origins:['cursor','limit']}[view];if(!spec)throw error('ASSOCIATION_INPUT_INVALID',400);
  const p={};for(const [k,v]of url.searchParams){if(k==='view')continue;if(!spec.includes(k)||Object.hasOwn(p,k))throw error('ASSOCIATION_INPUT_INVALID',400);p[k]=k==='limit'?Number(v):v;}data=await repository[{facts:'list',fact:'get',edges:'edges',origins:'origins'}[view]](p);
 }else if(request.method==='POST'){
  if(request.headers.get('origin')!==(origin??url.origin))throw error('ORIGIN_REJECTED',403);
  if(Number(request.headers.get('content-length')??0)>16384)throw error('ASSOCIATION_BODY_LIMIT',413);
  const reader=request.body?.getReader();if(!reader)throw error('ASSOCIATION_INPUT_INVALID',400);const chunks=[];let size=0;try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>16384){await reader.cancel();throw error('ASSOCIATION_BODY_LIMIT',413);}chunks.push(r.value);}}finally{reader.releaseLock();}
  let p;try{p=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw error('ASSOCIATION_INPUT_INVALID',400);}if(!p||typeof p!=='object'||Array.isArray(p)||!fields[p.operation]||Object.keys(p).some(k=>k!=='operation'&&!fields[p.operation].includes(k))||fields[p.operation].some(k=>!Object.hasOwn(p,k)))throw error('ASSOCIATION_INPUT_INVALID',400);
  const {operation,...input}=p;data=await repository[{resolve:'resolve',approve_origin:'approveOrigin',revoke_origin:'revokeOrigin'}[operation]](input);
 }else throw error('METHOD_NOT_ALLOWED',405);
 if(Buffer.byteLength(JSON.stringify({data}))>131072)throw error('ASSOCIATION_RESPONSE_LIMIT',413);return reply({data});
 }catch(e){const status=Number.isInteger(e?.status)&&e.status>=400&&e.status<=599?e.status:503;return reply({error:{code:typeof e?.code==='string'&&/^[A-Za-z0-9_]{1,100}$/.test(e.code)?e.code:'ASSOCIATION_UNAVAILABLE'}},status);}};}
