import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {inspectProcessGroup,signalProcessGroup} from './security-components.mjs';

// The composed runtime shares the controller's process group. Its watchdog may
// signal only the direct child; the outer controller owns group termination and
// Docker recovery. Standalone execution owns a separate group and proves it gone.
export async function runHistoryChild({args,cwd,env,fd,sharedGroup,abortSignal,receiptPath,timeoutMs=720000,graceMs=60000}){
  const receipt={mode:sharedGroup?'component-group':'owned-group',timedOut:false,hardKilled:false,spawnError:null,exitCode:null,signal:null,signals:[],lifecycleErrors:[],processGroupAbsent:null,deferredRecovery:sharedGroup};
  const save=()=>fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n',{mode:0o600});save();
  let child,closed=false,timer,killTimer,abandonTimer,resolveCompletion;
  const kill=signal=>{
    if(!child?.pid)return;
    let outcome;
    if(!sharedGroup)outcome=signalProcessGroup(child.pid,signal);
    else{
      if(closed)return; // Never signal the reused PID of a reaped direct child.
      try{process.kill(child.pid,signal);outcome={signal,state:'sent',target:'child-pid'};}
      catch(error){outcome={signal,state:error.code==='ESRCH'?'absent':'failed',code:error.code,target:'child-pid'};}
    }
    receipt.signals.push(outcome);
    if(outcome.state==='failed')receipt.lifecycleErrors.push('SIGNAL_'+signal+':'+outcome.code);
    save();
  };
  const stop=()=>{
    if(receipt.timedOut)return;receipt.timedOut=true;save();kill('SIGTERM');
    killTimer=setTimeout(()=>{
      receipt.hardKilled=true;kill('SIGKILL');
      abandonTimer=setTimeout(()=>{receipt.lifecycleErrors.push('HISTORY_CHILD_CLOSE_UNCONFIRMED');child?.unref();save();resolveCompletion?.();},2000);
    },graceMs);
  };
  try{
    child=spawn(process.execPath,args,{cwd,env,stdio:['ignore',fd,fd],detached:!sharedGroup});receipt.pid=child.pid??null;save();
    timer=setTimeout(stop,timeoutMs);abortSignal?.addEventListener('abort',stop,{once:true});
    process.once('SIGTERM',stop);process.once('SIGINT',stop);
    await new Promise(resolve=>{
      resolveCompletion=resolve;
      child.once('error',error=>{receipt.spawnError=error.message;save();});
      child.once('close',(exitCode,signal)=>{closed=true;receipt.exitCode=exitCode;receipt.signal=signal;resolve();});
    });
  }catch(error){receipt.lifecycleErrors.push(error.message);}
  finally{
    clearTimeout(timer);clearTimeout(killTimer);clearTimeout(abandonTimer);
    abortSignal?.removeEventListener('abort',stop);process.off('SIGTERM',stop);process.off('SIGINT',stop);
    kill('SIGKILL');
    if(!sharedGroup&&child?.pid){
      const deadline=Date.now()+2000;let group=inspectProcessGroup(child.pid);
      while(group.state==='present'&&Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,50));group=inspectProcessGroup(child.pid);}
      receipt.processGroup=group;receipt.processGroupAbsent=group.state==='absent';
      if(!receipt.processGroupAbsent)receipt.lifecycleErrors.push('HISTORY_GROUP_NOT_ABSENT:'+group.state);
    }else if(!child?.pid)receipt.processGroupAbsent=true;
    save();
  }
  return receipt;
}
