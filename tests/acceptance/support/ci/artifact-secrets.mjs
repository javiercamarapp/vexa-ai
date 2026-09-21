import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

// Invalid signature: fixtures cannot authenticate against any service.
export function syntheticJWT(role, nonce) {
 const b=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 return `${b({alg:'HS256',typ:'JWT'})}.${b({role,fixture:'F01-05',nonce})}.invalid_signature`;
}
export function canaries() {
 const nonce=randomUUID();
 return {nonce, server:`F0105_SERVER_ONLY_${nonce}`, service:syntheticJWT('service_role',nonce), anon:syntheticJWT('anon',nonce)};
}
export function assertNoSecrets(value, fixture, surface) {
 const raw=Buffer.isBuffer(value)?value.toString('utf8'):String(value);
 // Common wire encodings, without executing candidate JavaScript.
 const variants=[raw,raw.replace(/\\u([0-9a-f]{4})/gi,(_,h)=>String.fromCharCode(parseInt(h,16))).replace(/\\x([0-9a-f]{2})/gi,(_,h)=>String.fromCharCode(parseInt(h,16)))];
 try {variants.push(decodeURIComponent(raw));}catch{}
 for(const text of variants) {
  if([fixture.server,fixture.service].some(v=>v && text.includes(v))) throw new Error(`CLIENT_SECRET_LEAK:SERVER_CANARY:${surface}`);
  for(const match of text.matchAll(/[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
   let payload;try {payload=JSON.parse(Buffer.from(match[1],'base64url').toString());}catch{continue;}
   if(payload?.role==='service_role') throw new Error(`CLIENT_SECRET_LEAK:SERVICE_ROLE_JWT:${surface}`);
  }
 }
}
export function redact(value, fixture) {
 let text=String(value);
 for(const token of [fixture.server,fixture.service,fixture.anon]) text=text.split(token).join('[CANARY_REDACTED]');
 return text.replace(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,match=>{
  try {JSON.parse(Buffer.from(match.split('.')[1],'base64url').toString());return '[JWT_REDACTED]';}catch{return match;}
 });
}
function files(root) {
 if(!fs.existsSync(root))return [];
 return fs.readdirSync(root,{withFileTypes:true}).flatMap(entry=>{
  const file=path.join(root,entry.name);
  if(entry.isSymbolicLink())throw new Error('ARTIFACT_SYMLINK');
  return entry.isDirectory()?files(file):[file];
 });
}
export async function inspectPublished(cwd,origin,fixture,{allowUnconfiguredImports=false}={}) {
 let artifacts=0,requests=0;
 const queue=new Map([['/',false],['/login',false],['/api/health/version',true]]);
 const add=(url,required=false)=>queue.set(url,required||queue.get(url)||false);
 for(const [root,prefix] of [[path.join(cwd,'public'),'/'],[path.join(cwd,'.next/static'),'/_next/static/']]) {
  for(const file of files(root)) {
   assertNoSecrets(fs.readFileSync(file),fixture,'artifact');artifacts++;
   add(prefix+path.relative(root,file).split(path.sep).map(encodeURIComponent).join('/'),true);
  }
 }
 for(const file of files(path.join(cwd,'.next/server/app')).filter(p=>/\.(html|rsc|body)$/.test(p))) {
  assertNoSecrets(fs.readFileSync(file),fixture,'prerender');artifacts++;
 }
 for(const file of files(path.join(cwd,'src/app')).filter(p=>/\/page\.[jt]sx?$/.test(p))) {
  const route=path.relative(path.join(cwd,'src/app'),path.dirname(file)).split(path.sep).filter(p=>!/^\(.*\)$/.test(p)).map(p=>p.startsWith('[')?'ci-fixture':p).join('/');
  add('/'+route);
 }
 const seen=new Set();
 for(const [relative,required] of queue) {
  if(seen.has(relative))continue;
  if(seen.size>=2000)throw new Error('ARTIFACT_HTTP_LIMIT');
  seen.add(relative);
  const url=new URL(relative,origin);
  assertNoSecrets(url.href,fixture,'request');
  if(url.origin!==origin)continue; // Inspect external references; never contact them.
  const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(10000)});requests++;
  assertNoSecrets(JSON.stringify([...response.headers]),fixture,'response_headers');
  const body=await response.text();assertNoSecrets(body,fixture,'http');
  if(required && response.status!==200)throw new Error('ARTIFACT_HTTP_STATUS');
  if(response.status>=500){
   // Only the offline build smoke may acknowledge these explicit configuration contracts.
   // Body/header secret detection above still runs; pages and arbitrary 5xx fail.
   let envelope;try{envelope=JSON.parse(body);}catch{}
   const cache=response.headers.get('cache-control')??'';
   const imports=url.pathname==='/api/imports'&&envelope?.contract_version==='f02-durable-v1'&&envelope?.error?.code==='auth_not_configured';
   const crm=['/api/connections','/api/connections/settings','/api/migrations'].includes(url.pathname)&&envelope?.contract_version==='f03-crm-v1'&&envelope?.error?.code==='configuration_required';
   const extraction=url.pathname==='/api/extraction'&&envelope?.contract_version==='f04-extraction-v1'&&envelope?.error?.code==='configuration_required';
   const problems=url.pathname==='/api/problems'&&envelope?.contract_version==='f04-problems-v1'&&envelope?.error?.code==='configuration_required';
   const aliases=url.pathname==='/api/migrations/aliases'&&envelope?.contract_version==='f03-alias-v1'&&envelope?.error?.code==='configuration_required';
   const economics=url.pathname==='/api/economics'&&envelope?.contract_version==='f05-economics-v1'&&envelope?.error?.code==='configuration_required';
   const snapshots=url.pathname==='/api/economic-snapshots'&&envelope?.contract_version==='f05-snapshots-v1'&&envelope?.error?.code==='configuration_required';
   const priority=url.pathname==='/api/economic-priorities'&&envelope?.contract_version==='f05-priority-v1'&&envelope?.error?.code==='configuration_required';
   const expected=allowUnconfiguredImports===true&&!required&&response.status===503&&(imports||crm||extraction||aliases||problems||snapshots||economics||priority)&&!url.search
    &&/^application\/json(?:;|$)/i.test(response.headers.get('content-type')??'')
    &&/(?:^|,)\s*private\s*(?:,|$)/i.test(cache)&&/(?:^|,)\s*no-store\s*(?:,|$)/i.test(cache)
    &&envelope.error.retryable===true&&typeof envelope.error.message==='string'
    &&typeof envelope.meta?.trace_id==='string'&&envelope.meta.trace_id.length>0;
   if(!expected)throw new Error('PAGE_HTTP_STATUS:'+url.pathname+':'+response.status+':'+String(envelope?.error?.code));
  }
  const location=response.headers.get('location');if(location)add(new URL(location,url).href);
  // HTML/CSS assets and literal fetch/import URLs. No browser JS execution.
  for(const match of body.matchAll(/(?:src|href|action)=["']([^"']+)|url\(["']?([^\s)'";]+)|(?:fetch|import)\(["']([^"']+)/g)) {
   const ref=(match[1]??match[2]??match[3]).replaceAll('&amp;','&');
   assertNoSecrets(ref,fixture,'request');
   if(/^(?:data:|javascript:|#|mailto:)/i.test(ref))continue;
   const linked=new URL(ref,url);
   if(linked.origin===origin && !/\/auth\//.test(linked.pathname))add(linked.href);
  }
 }
 return {nonce:fixture.nonce,artifacts,requests};
}
