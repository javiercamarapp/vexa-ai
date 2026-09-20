import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {stripTypeScriptTypes} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),out=path.resolve(process.argv[2]??'');
if(!process.argv[2]||out===root||out.startsWith(root+'/'))throw Error('BUILD_REQUIRES_EXTERNAL_OUTPUT');
for(const name of ['ingestion','jobs/durable'])fs.cpSync(path.join(root,'packages',name),path.join(out,'packages',name),{recursive:true,filter:p=>!p.includes('/test')});
fs.mkdirSync(path.join(out,'packages/platform'),{recursive:true});
for(const name of ['db','session']){const source=fs.readFileSync(path.join(root,'packages/platform/src',name+'.ts'),'utf8');fs.writeFileSync(path.join(out,'packages/platform',name+'.mjs'),stripTypeScriptTypes(source).replaceAll("'@vexa/platform/session'","'./session.mjs'"));}
console.log('Durable JavaScript built');

const errorFile=path.join(out,'packages/jobs/durable/error.mjs');fs.writeFileSync(errorFile,fs.readFileSync(errorFile,'utf8').replace("../../platform/src/session.ts","../../platform/session.mjs"));
