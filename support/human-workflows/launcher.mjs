import {verifyHumanWorkflow} from './control.mjs';
export function launch(task){
 const e=process.env;
 try{
  const report=verifyHumanWorkflow({task,candidate:e.VEXA_CANDIDATE,manifestFile:e.VEXA_HUMAN_WORKFLOW_MANIFEST,reviewFile:e.VEXA_HUMAN_WORKFLOW_REVIEW,reviewSha256:e.VEXA_HUMAN_WORKFLOW_REVIEW_SHA256,approvalReference:e.VEXA_HUMAN_WORKFLOW_APPROVAL_REFERENCE});
  console.log(JSON.stringify(report));return report;
 }catch(error){const code=/^HUMAN_WORKFLOW_[A-Z_]+$/.test(error?.message??'')?error.message:'HUMAN_WORKFLOW_VERIFICATION_FAILED';throw new Error(code);}
}
