import{prepareLiveControl}from'./bootstrap.mjs';
let control;
try{control=await prepareLiveControl();const result=await control.runLive();control.close();console.log(JSON.stringify({...result,controlRuntimeRemoved:true,cleanupReceipt:control.cleanupReceipt}));}
catch(e){try{control?.close();}catch{};console.error(JSON.stringify({status:'failed',code:/^S01_[A-Z_]+$/.test(e?.code??'')?e.code:'S01_FAILED_REDACTED',cleanupReceipt:control?.cleanupReceipt??e?.cleanupReceipt??null,formalAcceptance:false}));process.exitCode=1;}
