#!/usr/bin/env node
import {open,mkdir,writeFile,lstat} from 'node:fs/promises';
import {constants,realpathSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {canonical,hashValue,EvaluationError} from './evaluate.mjs';
import {evaluatePilot} from './pilot.mjs';
const MAX_BYTES=50000000;
const fail=code=>{throw new EvaluationError(code);};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs;
async function readStable(path,handles){
 const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);handles.push(handle);const before=await handle.stat({bigint:true});
 if(!before.isFile()||before.size>BigInt(MAX_BYTES))fail('INPUT_FILE_INVALID');
 const chunks=[];let count=0;while(true){const buffer=Buffer.alloc(Math.min(65536,MAX_BYTES-count+1)),{bytesRead}=await handle.read(buffer,0,buffer.length,null);if(!bytesRead)break;count+=bytesRead;if(count>MAX_BYTES)fail('INPUT_FILE_INVALID');chunks.push(buffer.subarray(0,bytesRead));}
 const bytes=Buffer.concat(chunks,count),after=await handle.stat({bigint:true}),current=await lstat(path,{bigint:true});
 if(!current.isFile()||!same(before,after)||!same(before,current)||BigInt(count)!==before.size)fail('INPUT_CHANGED');
 return{path,handle,stat:after,bytes,sha256:hash(bytes)};
}
function parse(artifact){try{return JSON.parse(artifact.bytes.toString('utf8'));}catch{fail('INPUT_JSON_INVALID');}}
async function unchanged(artifact){const current=await lstat(artifact.path,{bigint:true}),descriptor=await artifact.handle.stat({bigint:true});if(!current.isFile()||!same(artifact.stat,current)||!same(artifact.stat,descriptor))fail('INPUT_CHANGED');}
export async function main(argv=process.argv.slice(2)){
 const names=['study','evaluation','evaluation-receipt','out'],flags={};if(argv.length!==8)fail('USAGE');
 for(let i=0;i<argv.length;i+=2){const name=argv[i]?.slice(2);if(!argv[i]?.startsWith('--')||!names.includes(name)||Object.hasOwn(flags,name)||typeof argv[i+1]!=='string'||!argv[i+1]||argv[i+1].startsWith('--'))fail('USAGE');flags[name]=resolve(argv[i+1]);}
 if(names.some(n=>!flags[n]))fail('USAGE');const handles=[];
 try{
  const studyFile=await readStable(flags.study,handles),evaluationFile=await readStable(flags.evaluation,handles),priorFile=await readStable(flags['evaluation-receipt'],handles);
  const study=parse(studyFile),evaluation=parse(evaluationFile),prior=parse(priorFile);
  const engineFile=await readStable(fileURLToPath(new URL('./pilot.mjs',import.meta.url)),handles),cliFile=await readStable(fileURLToPath(import.meta.url),handles),f04Engine=await readStable(fileURLToPath(new URL('./evaluate.mjs',import.meta.url)),handles),f04Cli=await readStable(fileURLToPath(new URL('./cli.mjs',import.meta.url)),handles);
  const valid=prior&&prior.schema_version==='vexa-evaluation-receipt-v1'&&prior.exit_code===0&&prior.release_decision==='not_issued'&&['measured','not_measured'].includes(prior.status)&&prior.status===evaluation?.status&&prior.result_hash===hashValue(evaluation)&&prior.result_file_hash===evaluationFile.sha256&&prior.engine_hash===f04Engine.sha256&&prior.cli_hash===f04Cli.sha256&&prior.exposure?.protocol_hash===evaluation.input_hashes?.protocol&&prior.exposure?.holdout_hash===evaluation.input_hashes?.holdout&&prior.exposure?.candidate_hash===hashValue(evaluation.candidate)&&prior.exposure?.prediction_hash===evaluation.input_hashes?.predictions&&['protocol','dataset','predictions'].every(k=>digest(prior.input_file_hashes?.[k]));
  if(!valid)fail('EVALUATION_RECEIPT_INVALID');const result=evaluatePilot({study,evaluation}),resultBytes=Buffer.from(canonical(result)+'\n');
  for(const artifact of [studyFile,evaluationFile,priorFile,engineFile,cliFile,f04Engine,f04Cli])await unchanged(artifact);
  const receipt={schema_version:'vexa-pilot-receipt-v1',created_at:new Date().toISOString(),command:'pilot',node_version:process.version,exit_code:0,status:result.status,result_hash:hashValue(result),result_file_hash:hash(resultBytes),input_file_hashes:{study:studyFile.sha256,evaluation:evaluationFile.sha256,evaluation_receipt:priorFile.sha256},engine_hash:engineFile.sha256,cli_hash:cliFile.sha256,evaluation_engine_hash:f04Engine.sha256,evaluation_cli_hash:f04Cli.sha256,release_decision:'not_issued'};
  await mkdir(flags.out,{mode:0o700});await writeFile(join(flags.out,'result.json'),resultBytes,{flag:'wx',mode:0o600});await writeFile(join(flags.out,'receipt.json'),canonical(receipt)+'\n',{flag:'wx',mode:0o600});
  return{status:result.status,result_hash:receipt.result_hash,production_validated:false,formal_acceptance:false};
 }finally{await Promise.allSettled(handles.map(h=>h.close()));}
}
function entry(){try{return !!process.argv[1]&&realpathSync(process.argv[1])===realpathSync(fileURLToPath(import.meta.url));}catch{return false;}}
if(entry())main().then(result=>process.stdout.write(JSON.stringify(result)+'\n')).catch(error=>{const code=error instanceof EvaluationError?error.code:error?.code==='EEXIST'?'OUTPUT_EXISTS':'PILOT_FAILED';process.stderr.write(JSON.stringify({status:'failed',code})+'\n');process.exitCode=1;});
