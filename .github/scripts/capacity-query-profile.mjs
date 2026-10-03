// Synthetic benchmark instrumentation only. Never stores SQL, values or errors.
import {createHash} from 'node:crypto';
export function createQueryProfile({now=()=>performance.now(),maxGroups=128}={}) {
  if(!Number.isSafeInteger(maxGroups)||maxGroups<1||maxGroups>128)throw Error('PROFILE_BOUND');
  let groups,started,completed,failed,pending,overflow,unclassified,invalidDurations;
  function reset(){
    if(pending)throw Error('PROFILE_QUERIES_PENDING');
    groups=new Map();started=completed=failed=pending=overflow=unclassified=invalidDurations=0;
  }
  reset();
  function clock(){try{const value=now();return typeof value==='number'&&Number.isFinite(value)?value:NaN;}catch{return NaN;}}
  async function run(sql,invoke){
    let group;
    if(typeof sql==='string'){
      const querySha256=createHash('sha256').update(sql).digest('hex');
      group=groups.get(querySha256);
      if(!group&&groups.size<maxGroups){group={querySha256,count:0,failed:0,totalMs:0,minMs:null,maxMs:0};groups.set(querySha256,group);}
      if(!group)overflow++;
    }else unclassified++;
    started++;pending++;const begin=clock();let ok=false;
    try{const result=await invoke();ok=true;return result;}
    finally{
      const duration=clock()-begin;pending--;completed++;if(!ok)failed++;
      const valid=Number.isFinite(duration)&&duration>=0;
      if(!valid)invalidDurations++;
      if(group){group.count++;if(!ok)group.failed++;if(valid){group.totalMs+=duration;group.minMs=group.minMs===null?duration:Math.min(group.minMs,duration);group.maxMs=Math.max(group.maxMs,duration);}}
    }
  }
  function snapshot(){return {schema:'vexa-synthetic-sql-profile-v1',complete:pending===0&&overflow===0&&unclassified===0&&invalidDurations===0,started,completed,failed,pending,overflow,unclassified,invalidDurations,groups:[...groups.values()].map(g=>({...g})).sort((a,b)=>a.querySha256.localeCompare(b.querySha256))};}
  return Object.freeze({run,reset,snapshot});
}
