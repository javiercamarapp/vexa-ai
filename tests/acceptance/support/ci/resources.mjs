// Trusted control infrastructure; never pass these variables to product builds.
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const label='vexa.ci.broker';
export function resourceBroker() {
 const journal=process.env.VEXA_CI_JOURNAL;
 const broker=process.env.VEXA_CI_BROKER ?? randomUUID();
 if (!/^[0-9a-f-]{36}$/.test(broker) || (!!journal !== !!process.env.VEXA_CI_BROKER)) throw Error('RESOURCE_BROKER_CONFIG');
 const entries=new Map();
 const append=entry=>{
  if(!journal)return;
  const fd=fs.openSync(journal,fs.constants.O_WRONLY|fs.constants.O_APPEND|fs.constants.O_NOFOLLOW);
  try {const s=fs.fstatSync(fd);if(!s.isFile()||(s.mode&0o777)!==0o600)throw Error('RESOURCE_JOURNAL_MODE');fs.writeSync(fd,JSON.stringify(entry)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 };
 function reserve(kind,name){
  if(!['container','network'].includes(kind)||!/^vexa-f01-0[234]-[0-9a-f-]{36}(?:-[a-z]+)?$/.test(name))throw Error('RESOURCE_NAME');
  const e={kind,name,broker};append(e);entries.set(kind+':'+name,e);
  return ['--label',`${label}=${broker}`];
 }
 function remove(kind,name){
  if(!entries.has(kind+':'+name))throw Error('RESOURCE_UNREGISTERED');
  const args=kind==='network'?['network','inspect']:['container','inspect'];
  const inspect=()=>{
   const r=spawnSync('docker',[...args,name,'--format',`{{.Id}}|{{.Name}}|{{ index ${kind==='network'?'.Labels':'.Config.Labels'} "${label}" }}`],{encoding:'utf8',timeout:15000});
   if(r.status!==0){if(!r.error&&(/No such (?:object|container|network)/i.test(r.stderr)||r.stderr.trim()===`Error response from daemon: network ${name} not found`))return null;throw Error('RESOURCE_INSPECT_FAILED');}
   const [id,actual,owner]=r.stdout.trim().split('|');
   if(!/^[a-f0-9]{64}$/.test(id)||actual.replace(/^\//,'')!==name||owner!==broker)throw Error('RESOURCE_OWNERSHIP_MISMATCH');return id;
  };
  const id=inspect();if(!id)return;
  const r=spawnSync('docker',kind==='network'?['network','rm',id]:['container','rm','-f','-v',id],{encoding:'utf8',timeout:15000});
  if(r.error||r.status!==0||inspect()!==null)throw Error('RESOURCE_CLEANUP_FAILED');
 }
 return {reserve,remove};
}
