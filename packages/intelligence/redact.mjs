import {sha256} from './index.mjs';
const fail=()=>{throw Error('REDACTION_INPUT_OR_POLICY_INVALID');};
const segmenter=new Intl.Segmenter('und',{granularity:'grapheme'});
const folded=value=>value.normalize('NFC').toLowerCase();
/** Explicit server policy. Dictionary mode covers configured names, not arbitrary NER. */
export function redactText(text,policy){
 if(typeof window!=='undefined'||typeof text!=='string'||text.length>100000||!text.isWellFormed())fail();
 const p=structuredClone(policy);
 if(!p||typeof p.version!=='string'||!/^[a-zA-Z0-9_.:-]{1,100}$/.test(p.version)||p.emails!==true||p.phones!==true||!['dictionary','suppress_all'].includes(p.namesMode)||!Array.isArray(p.names)||p.names.length>500||p.names.some(n=>typeof n!=='string'||!n.trim()||n.length>200||!n.isWellFormed()))fail();
 const policyHash=sha256(JSON.stringify({version:p.version,emails:true,phones:true,namesMode:p.namesMode,names:[...new Set(p.names.map(folded))].sort()}));
 const points=[...text],cpAt=new Map();let u=0;cpAt.set(0,0);points.forEach((point,i)=>{u+=point.length;cpAt.set(u,i+1);});
 const ranges=[];
 const capture=regex=>{for(const m of text.matchAll(regex)){const start=cpAt.get(m.index),end=cpAt.get(m.index+m[0].length);if(start===undefined||end===undefined)fail();ranges.push({start,end});}};
 if(p.namesMode==='suppress_all'){if(points.length)ranges.push({start:0,end:points.length});}
 else{
  capture(/[\p{L}\p{N}._%+\-]+@[\p{L}\p{N}](?:[\p{L}\p{N}.\-]*[\p{L}\p{N}])?/gu);
  capture(/(?<![\p{L}\p{N}])\+?\d(?:[ .()\-\u00a0]*\d){6,14}(?:[ ]*(?:ext\.?|x)[ ]*\d{1,6})?(?![\p{L}\p{N}])/giu);
  // A folded grapheme index retains offsets in the untouched source, including NFD names.
  let normalized='';const original=[];
  for(const {segment,index} of segmenter.segment(text)){const v=folded(segment),start=cpAt.get(index),end=cpAt.get(index+segment.length);for(let i=0;i<v.length;i++)original.push({start,end});normalized+=v;}
  for(const name of new Set(p.names.map(folded))){let from=0,index;while((index=normalized.indexOf(name,from))!==-1){const end=index+name.length,before=[...normalized.slice(0,index)].at(-1),after=[...normalized.slice(end)][0];if(!before||!/[\p{L}\p{N}]/u.test(before)){if(!after||!/[\p{L}\p{N}]/u.test(after))ranges.push({start:original[index].start,end:original[end-1].end});}from=index+Math.max(1,name.length);}}
 }
 ranges.sort((a,b)=>a.start-b.start||b.end-a.end);const merged=[];
 for(const span of ranges){const last=merged.at(-1);if(last&&span.start<last.end)last.end=Math.max(last.end,span.end);else merged.push({...span});}
 let cursor=0,length=0;const chunks=[],privateMap=[];
 for(const span of merged){const prefix=points.slice(cursor,span.start).join(''),replacement=p.namesMode==='suppress_all'?'[REDACTED]':'[PII]';chunks.push(prefix,replacement);length+=span.start-cursor;privateMap.push({originalStart:span.start,originalEnd:span.end,start:length,end:length+[...replacement].length,original:points.slice(span.start,span.end).join(''),replacement});length+=[...replacement].length;cursor=span.end;}
 chunks.push(points.slice(cursor).join(''));const redacted=chunks.join('');
 return {text:redacted,hash:sha256(redacted),redactionVersion:p.version,policyHash,privateMap};
}
