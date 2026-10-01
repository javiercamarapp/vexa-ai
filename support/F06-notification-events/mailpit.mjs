import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync,spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
export async function mailpit(evidence){
 const name='vexa-SYN426-mailpit-'+randomUUID();
 const run=spawnSync('docker',['run','--pull','never','-d','--name',name,'--network','none','public.ecr.aws/supabase/mailpit:v1.30.2'],{encoding:'utf8',timeout:20000});
 assert.equal(run.status,0,'MAILPIT_LOCAL_START');
 const id=run.stdout.trim();fs.writeFileSync(path.join(evidence,'mailpit-owned.json'),JSON.stringify({name,id,network:'none',smtpRelay:false}));
 const children=new Set();const tunnel=createServer(socket=>{const child=spawn('docker',['exec','-i',id,'nc','127.0.0.1','1025'],{stdio:['pipe','pipe','ignore']});children.add(child);socket.pipe(child.stdin);child.stdout.pipe(socket);socket.on('error',()=>{});child.stdin.on('error',()=>{});socket.on('close',()=>child.kill());child.on('exit',()=>{children.delete(child);socket.destroy();});});
 try{tunnel.listen(60864,'127.0.0.1');await once(tunnel,'listening');}catch(error){tunnel.close();spawnSync('docker',['rm','-f',id],{encoding:'utf8',timeout:15000});throw error;}
 const json=resource=>{const r=spawnSync('docker',['exec',id,'wget','-qO-','http://127.0.0.1:8025/api/v1/'+resource],{encoding:'utf8',timeout:10000});assert.equal(r.status,0,'MAILPIT_API');return JSON.parse(r.stdout);};
 return {id,json,async close(){for(const child of children){if(child.exitCode===null&&child.signalCode===null){const ended=once(child,'exit');child.kill('SIGKILL');await ended;}}await new Promise(resolve=>tunnel.close(resolve));const r=spawnSync('docker',['rm','-f',id],{encoding:'utf8',timeout:15000});assert.equal(r.status,0,'MAILPIT_CLEANUP');const v=spawnSync('docker',['inspect',id],{encoding:'utf8',timeout:10000});assert.match(v.stderr,/no such/i);fs.writeFileSync(path.join(evidence,'mailpit-cleanup.json'),JSON.stringify({id,absent:true}));}};
}

export {ownMailpit} from '../F06-email/harness.mjs';
