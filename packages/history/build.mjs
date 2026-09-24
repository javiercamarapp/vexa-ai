import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.resolve(process.argv[2]??'');
if(!process.argv[2]||out===root||out.startsWith(root+'/'))throw Error('BUILD_REQUIRES_EXTERNAL_OUTPUT');
const child=spawnSync(process.execPath,[path.join(root,'packages/jobs/durable/build.mjs'),out],{stdio:'inherit'});if(child.status!==0)throw Error('BASE_BUILD_FAILED');
for(const name of ['history','gateway','intelligence','problems'])fs.cpSync(path.join(root,'packages',name),path.join(out,'packages',name),{recursive:true,filter:p=>!p.includes('/tests')&&!p.endsWith('.test.mjs')});
console.log('History worker JavaScript built');
