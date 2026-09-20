// M10: run against the REAL built Next static chunks and collected public responses.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
export function clientBoundary(build,publicBodies,serverCanary){
 assert.ok(serverCanary?.length>=32,'M10_SETUP_CANARY');
 const dir=path.join(build,'apps/web/.next/static');assert.ok(fs.existsSync(dir),'M10_SETUP_REAL_BUILD');
 let chunks=0;const check=s=>{assert.ok(!s.includes(serverCanary),'M10_SERVER_SECRET');assert.doesNotMatch(s,/-----BEGIN (?:RSA )?PRIVATE KEY-----/,'M10_PRIVATE_KEY');
 for(const match of s.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)){let claims;try{claims=JSON.parse(Buffer.from(match[1],'base64url'));}catch{continue;}assert.ok(claims.role!=='service_role','M10_SERVICE_ROLE');}};
 function walk(d){for(const name of fs.readdirSync(d)){const p=path.join(d,name);if(fs.statSync(p).isDirectory())walk(p);else if(/\.(js|map)$/.test(p)){chunks++;check(fs.readFileSync(p,'utf8'));}}}
 walk(dir);assert.ok(chunks>0,'M10_REAL_CHUNKS');assert.ok(publicBodies.length>0,'M10_REAL_HTTP');for(const text of publicBodies)check(text);
 return {chunks,responses:publicBodies.length};
}
