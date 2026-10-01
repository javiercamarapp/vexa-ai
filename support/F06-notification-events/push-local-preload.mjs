// Control-only TLS socket adapter. Product factory/SDK/runtime remain unmodified.
import assert from 'node:assert/strict';import fs from 'node:fs';import https from 'node:https';
const socketPath=process.env.SYN_PUSH_SOCKET,pathname=process.env.SYN_PUSH_PATH,journal=process.env.SYN_PUSH_JOURNAL;
assert.ok(socketPath?.startsWith('/tmp/vexa-push305-')&&socketPath.endsWith('/tls.sock'));assert.ok(pathname?.startsWith('/fcm/send/SYN305_'));assert.ok(journal);
const request=https.request;
https.request=(url,options,callback)=>{const parsed=new URL(url);const allowed=parsed.origin==='https://fcm.googleapis.com'&&parsed.pathname===pathname&&!parsed.search&&!parsed.hash;
 fs.appendFileSync(journal,JSON.stringify({origin:parsed.origin,path:parsed.pathname,localFixture:allowed})+'\n',{mode:0o600});assert.equal(allowed,true,'NO_EXTERNAL_HTTPS_ALLOWED_IN_PUSH_EXAM');
 return request('https://localhost'+pathname,{...options,socketPath,rejectUnauthorized:false},callback);
};
