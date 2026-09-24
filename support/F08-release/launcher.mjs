import {mkdtemp,writeFile,chmod,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyRelease} from './control.mjs';
export async function launch(){
 const candidate=process.env.VEXA_CANDIDATE,manifestFile=process.env.VEXA_RELEASE_MANIFEST,authorizationFile=process.env.VEXA_RELEASE_VERIFICATION_AUTHORIZATION,approvalReference=process.env.VEXA_RELEASE_APPROVAL_REFERENCE;
 if(!candidate||!manifestFile||!authorizationFile||!approvalReference)throw new Error('F0801_EXTERNAL_BLOCKED: candidate, private manifest and legitimate supervisor approval required');
 const out=await mkdtemp(join(await realpath(tmpdir()),'vexa-f0801-'));await chmod(out,0o700);
 try{const report=await verifyRelease({candidate,manifestFile,authorizationFile,approvalReference});await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log('F08-01 evidence: '+out);return report;}
 catch(error){const code=/^F0801_[A-Z_]+$/.test(error?.message??'')?error.message:'F0801_VERIFICATION_FAILED';await writeFile(join(out,'report.json'),JSON.stringify({status:'fail',code,formalAcceptance:false})+'\n',{mode:0o600});console.log('F08-01 evidence: '+out);throw new Error(code);}
}
