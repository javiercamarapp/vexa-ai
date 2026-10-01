import fs from 'node:fs';import path from 'node:path';import {mailpit,ownMailpit} from './harness.mjs';
const evidence=process.env.SYN421_EVIDENCE;const h={async close(){fs.writeFileSync(path.join(evidence,'runtime-close.json'),JSON.stringify({closed:true}));}};
const fixture=await mailpit(evidence);if(process.env.SYN421_FIX==='1')ownMailpit(h,fixture);
const stop=()=>{void h.close().finally(()=>process.exit(1));};process.once('SIGTERM',stop);process.send({ready:true,id:fixture.id});
