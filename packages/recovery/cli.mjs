import fs from 'node:fs/promises';import {backupLocal,restoreLocal,repositoryLocal} from './local.mjs';
const [command,filename]=process.argv.slice(2);
try{
 if(!['backup','restore','erase','export-ledger','purge-artifacts'].includes(command)||!filename||process.argv.length!==4)throw Error('ARGUMENTS');
 const plan=JSON.parse(await fs.readFile(filename,'utf8'));let result;
 if(command==='backup')result=await backupLocal(plan);
 else if(command==='restore')result=await restoreLocal(plan);
 else{const key=plan.ledgerKeyFile?await fs.readFile(plan.ledgerKeyFile,'utf8'):undefined;const local=await repositoryLocal(plan,key);try{if(command==='erase')result=await local.repository.erase(plan.request);else if(command==='purge-artifacts')result=await local.repository.purgeArtifacts();else{result=await local.repository.exportLedger();await fs.writeFile(plan.ledgerFile,JSON.stringify(result),{flag:'wx',mode:0o600});result={ledgerFile:plan.ledgerFile,sha256:result.sha256};}}finally{await local.close();}}
 console.log(JSON.stringify(result));
}catch{console.error('RECOVERY_FAILED_CLOSED: inspect owned local fixture; preserve original backup and blocked restore.');process.exitCode=1;}
