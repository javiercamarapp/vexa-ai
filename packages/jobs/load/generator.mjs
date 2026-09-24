import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const LIMITS=Object.freeze({rowsPerFile:50000,bytesPerFile:20*1024*1024});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function generateDataset({rows,seed,directory}){
 if(![10000,50000,150000].includes(rows)||!Number.isInteger(seed)||seed<1||seed>0xffffffff)throw Error('LOAD_DATASET_ARGUMENT_INVALID');
 fs.mkdirSync(directory,{recursive:true});let state=seed>>>0;
 const next=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return state>>>0;};
 const files=[];let accepted=0,rejected=0,duplicates=0;
 for(let start=0;start<rows;start+=LIMITS.rowsPerFile){const count=Math.min(LIMITS.rowsPerFile,rows-start);let previous,line;const records=[];
  for(let j=0;j<count;j++){const i=start+j;if(i%100===99){line=previous;duplicates++;}else{const date=i%100===49?'SYN-invalid-date':'2026-09-01T00:00:00Z';line=`SYN308-${rows}-${seed}-${i},SYN fixture ${next().toString(16)} registro ${i},${date},customer,SYN-conversation-${rows}-${seed}-${i}`;if(i%100===49)rejected++;else accepted++;}records.push(line);previous=line;}
  const bytes=Buffer.from('id,text,date,role,conversation\n'+records.join('\n')+'\n');if(bytes.length>LIMITS.bytesPerFile)throw Error('LOAD_PARTITION_TOO_LARGE');
  const filename=`SYN-${rows}-${seed}-part-${files.length+1}.csv`,file=path.join(directory,filename);fs.writeFileSync(file,bytes,{flag:'wx'});files.push({filename,rows:count,bytes:bytes.length,sha256:sha(bytes),firstIndex:start,lastIndex:start+count-1});
 }
 const manifest={schema:'vexa-synthetic-load-v1',synthetic:true,rows,seed,generator:'xorshift32;1% invalid dates;1% exact previous-line duplicates',limits:LIMITS,expected:{total:rows,accepted,rejected,duplicates,pending:0},files};
 manifest.sha256=sha(JSON.stringify(manifest));fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});return manifest;
}
