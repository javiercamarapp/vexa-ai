import fs from 'node:fs';
import path from 'node:path';

const requireThat=(ok,code)=>{if(!ok)throw Error(code);};
const contains=(parent,child)=>child===parent||child.startsWith(parent+path.sep);
export function prepareEvidence(candidate,input){
 requireThat(typeof input==='string'&&input.length>0,'EVIDENCE_REQUIRED');
 const root=fs.realpathSync(candidate),out=path.resolve(input),parent=path.dirname(out);
 let cursor=path.parse(out).root;
 for(const part of out.slice(cursor.length).split(path.sep)){
  cursor=path.join(cursor,part);const stat=fs.lstatSync(cursor,{throwIfNoEntry:false});
  requireThat(!stat?.isSymbolicLink(),'EVIDENCE_SYMLINK');
 }
 requireThat(fs.existsSync(parent)&&fs.statSync(parent).isDirectory(),'EVIDENCE_PARENT_REQUIRED');
 const canonical=path.join(fs.realpathSync(parent),path.basename(out));
 requireThat(!contains(root,canonical)&&!contains(canonical,root),'EVIDENCE_OVERLAP');
 requireThat(!fs.lstatSync(out,{throwIfNoEntry:false}),'EVIDENCE_EXISTS');
 fs.mkdirSync(out,{mode:0o700});
 requireThat((fs.statSync(out).mode&0o777)===0o700,'EVIDENCE_MODE');
 return out;
}
export function replaceRequired(source,pattern,replacement,label,all=false){
 requireThat(typeof pattern==='string'?source.includes(pattern):new RegExp(pattern.source,pattern.flags).test(source),'HARNESS_CONTRACT_'+label);
 return all?source.replaceAll(pattern,replacement):source.replace(pattern,replacement);
}
export function validateProcess(result,label){
 requireThat(!result.error,'PROCESS_ERROR_'+label);
 requireThat(result.signal===null,'PROCESS_SIGNAL_'+label);
 requireThat(result.status===0,'PROCESS_STATUS_'+label);
}
export async function boundedWait(promise,timeoutMs,label){
 let timer;
 try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label)),timeoutMs);})]);}
 finally{clearTimeout(timer);}
}
