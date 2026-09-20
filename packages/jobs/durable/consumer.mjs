import {JobError} from './error.mjs';
// pages(job, checkpoint) may load an immutable CSV via a scoped storage port or
// return adapter.pages({checkpoint}); no checkpoint is acknowledged before commit.
export async function consumeOne({repository,pages,leaseMs=30000,maxSourceWaitMs=300000,afterCommit=async()=>{},maxChunks=Infinity}) {
  if(!Number.isSafeInteger(leaseMs)||leaseMs<3||leaseMs>300000||!Number.isSafeInteger(maxSourceWaitMs)||maxSourceWaitMs<1||maxSourceWaitMs>300000)throw new JobError('INVALID_JOB_CONFIG');
  const job=await repository.claim({leaseMs});if(!job)return null;
  const controller=new AbortController();
  // Heartbeat only during source work: never compete with a chunk transaction's row lock.
  // Recursive timer serializes renewals; every exit clears timers and drains its renewal.
  async function waitSource(operation) {
    let stopped=false,timer,deadline,inFlight,failure;
    let rejectHeartbeat;
    const heartbeatFailure=new Promise((_,reject)=>{rejectHeartbeat=reject;});
    const schedule=()=>{timer=setTimeout(()=>{
      inFlight=(async()=>{
        try {await repository.renew(job);if(!stopped)schedule();}
        catch(error){failure=error;controller.abort(error);rejectHeartbeat(error);}
      })();
    },Math.max(1,Math.floor(leaseMs/3)));};
    const timeout=new Promise((_,reject)=>{deadline=setTimeout(()=>{
      const error=Object.assign(new JobError('SOURCE_TIMEOUT'),{retryable:true});
      controller.abort(error);reject(error);
    },maxSourceWaitMs);});
    schedule();
    try {
      const value=await Promise.race([Promise.resolve().then(operation),heartbeatFailure,timeout]);
      stopped=true;clearTimeout(timer);await inFlight;
      if(failure)throw failure;
      if(controller.signal.aborted)throw controller.signal.reason;
      return value;
    } finally {stopped=true;clearTimeout(timer);clearTimeout(deadline);await inFlight;}
  }
  try {
    const cp=await repository.checkpoint(job);
    if(cp?.done)return await repository.ack(job);
    let sequence=cp?.sequence??0,done=false;
    const source=await waitSource(()=>pages(job,cp??null,{signal:controller.signal}));
    const iterator=source[Symbol.asyncIterator]?.()??source[Symbol.iterator]?.();
    if(!iterator)throw new JobError('INVALID_SOURCE');
    let chunks=0;
    while(true) {
      // Renew/re-authorize immediately before every source operation, including after a commit.
      await repository.renew(job);
      const next=await waitSource(()=>iterator.next());
      if(next.done)break;
      const page=next.value;
      await repository.renew(job);
      await repository.commitChunk(job,{sequence:++sequence,records:page.records,errors:page.errors,checkpoint:page.checkpoint,done:page.done});
      await afterCommit(job);
      if(page.done){done=true;if(iterator.return)await waitSource(()=>iterator.return());break;}
      if(++chunks>=maxChunks){if(iterator.return)await iterator.return();return await repository.release(job);}
    }
    if(!done)throw Object.assign(new JobError('SOURCE_INCOMPLETE'),{retryable:true});
    return await repository.ack(job);
  } catch(error) {
    controller.abort(error);
    if(error.code==='STALE_FENCE')throw error;
    await repository.fail(job,error);
    throw error;
  } finally {controller.abort();}
}
