import {canonicalPorts} from '../F02-durable/canonical-ports.mjs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
let input='';for await(const chunk of process.stdin)input+=chunk;
const {config,candidate,actor,importId,record}=JSON.parse(input);
const ports=await canonicalPorts(config);
try{
 const {persistCanonical}=await import(pathToFileURL(path.join(candidate,'packages/ingestion/persistence/index.mjs')));
 const database=ports.database(new Request('http://fixture.test',{headers:{Authorization:'Bearer '+actor.token,'x-vexa-organization':actor.tenant}}));
 const result=await database.transaction('import',s=>persistCanonical(s,{importId,record}));
 process.stdout.write(JSON.stringify(result));
}finally{ports.close();}
