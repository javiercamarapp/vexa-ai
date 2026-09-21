#!/usr/bin/env node
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {evaluate,freezeProtocol,exportDevelopment,hashValue,EvaluationError} from './evaluate.mjs';
const fail=code=>{throw new EvaluationError(code);};
async function json(path,hashes){if(!path)fail('ARGUMENT_MISSING');const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink()||s.size>50000000)fail('INPUT_FILE_INVALID');const bytes=await readFile(path);const parsed=JSON.parse(bytes.toString('utf8'));hashes?.set(path,createHash('sha256').update(bytes).digest('hex'));return parsed;}
const write=(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
export async function main(argv=process.argv.slice(2)){
 const inputHashes=new Map(),readJSON=path=>json(path,inputHashes);
 const [command,...args]=argv;const allowed=command==='freeze'?['dataset','spec','out']:command==='evaluate'?['protocol','dataset','predictions','out','ledger']:command==='export-dev'?['protocol','dataset','out']:[];
 if(!allowed.length||args.length!==allowed.length*2)fail('USAGE');const flags={};for(let i=0;i<args.length;i+=2){const key=args[i]?.slice(2);if(!args[i]?.startsWith('--')||!allowed.includes(key)||flags[key]||!args[i+1])fail('USAGE');flags[key]=resolve(args[i+1]);}if(allowed.some(k=>!flags[k]))fail('USAGE');
 const dataset=await readJSON(flags.dataset);
 if(command==='freeze'){const protocol=freezeProtocol({dataset,spec:await readJSON(flags.spec)});await write(flags.out,protocol);return {status:'frozen',protocol_hash:hashValue(protocol),path:flags.out};}
 const protocol=await readJSON(flags.protocol);
 if(command==='export-dev'){const exported=exportDevelopment({protocol,dataset});await write(flags.out,exported);return {status:'development_exported',export_hash:hashValue(exported),cases:exported.cases.length,path:flags.out};}
 const predictions=await readJSON(flags.predictions),result=evaluate({protocol,dataset,predictions});
 // One external holdout may assess only one frozen candidate/prediction set. Identical replay is reproducible.
 const exposure={protocol_hash:hashValue(protocol),holdout_hash:protocol.holdout_hash,candidate_hash:hashValue(predictions.candidate),prediction_hash:hashValue(predictions)};let replay=false;
 try{await write(flags.ledger,exposure);}catch(e){if(e.code!=='EEXIST')throw e;const prior=await readJSON(flags.ledger);if(hashValue(prior)!==hashValue(exposure))fail('HOLDOUT_ALREADY_EXPOSED');replay=true;}
 await mkdir(flags.out,{mode:0o700});const resultPath=join(flags.out,'result.json');await write(resultPath,result);
 const hashFile=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
 const receipt={schema_version:'vexa-evaluation-receipt-v1',created_at:new Date().toISOString(),command:[process.execPath,fileURLToPath(import.meta.url),...argv],exit_code:0,result_hash:hashValue(result),result_file_hash:await hashFile(resultPath),input_file_hashes:{protocol:inputHashes.get(flags.protocol),dataset:inputHashes.get(flags.dataset),predictions:inputHashes.get(flags.predictions)},engine_hash:await hashFile(fileURLToPath(new URL('./evaluate.mjs',import.meta.url))),cli_hash:await hashFile(fileURLToPath(import.meta.url)),exposure,replay,status:result.status,release_decision:'not_issued'};
 await write(join(flags.out,'receipt.json'),receipt);return {status:result.status,result_hash:receipt.result_hash,path:flags.out,replay};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){main().then(result=>process.stdout.write(JSON.stringify(result)+'\n')).catch(error=>{const code=error instanceof EvaluationError?error.code:error?.code==='EEXIST'?'OUTPUT_EXISTS':'EVALUATION_FAILED';process.stderr.write(JSON.stringify({status:'failed',code})+'\n');process.exitCode=1;});}
