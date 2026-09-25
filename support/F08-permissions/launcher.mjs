import {mkdtemp,writeFile,chmod,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative,isAbsolute} from 'node:path';
import {verifyPermissions} from './control.mjs';
export async function launch(){
 const candidate=process.env.VEXA_CANDIDATE,manifestFile=process.env.VEXA_PERMISSIONS_MANIFEST,authorizationFile=process.env.VEXA_PERMISSIONS_AUTHORIZATION,approvalReference=process.env.VEXA_PERMISSIONS_APPROVAL_REFERENCE;
 if(!candidate||!manifestFile||!authorizationFile||!approvalReference)throw new Error('F0804_EXTERNAL_BLOCKED');
 const temp=await realpath(tmpdir()),rel=relative(await realpath(candidate),temp);
 if(rel===''||(!rel.startsWith('../')&&rel!=='..'&&!isAbsolute(rel)))throw new Error('F0804_OUTPUT_INSIDE_CANDIDATE');
 const out=await mkdtemp(join(temp,'vexa-f0804-'));await chmod(out,0o700);
 try{const report=await verifyPermissions({candidate,manifestFile,authorizationFile,approvalReference});await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log('F08-04 evidence: '+out);return report;}
 catch(error){const code=/^F0804_[A-Z_]+$/.test(error?.message??'')?error.message:'F0804_VERIFICATION_FAILED';await writeFile(join(out,'report.json'),JSON.stringify({status:'fail',code,formalAcceptance:false})+'\n',{mode:0o600});console.log('F08-04 evidence: '+out);throw new Error(code);}
}
