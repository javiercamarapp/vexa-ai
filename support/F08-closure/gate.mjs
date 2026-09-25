import {verifyClosure} from './control.mjs';
export async function launch() {
 return verifyClosure({candidate:process.env.VEXA_CANDIDATE,dossierFile:process.env.VEXA_CLOSURE_DOSSIER,authorizationFile:process.env.VEXA_CLOSURE_AUTHORIZATION,approvalReference:process.env.VEXA_CLOSURE_APPROVAL_REFERENCE});
}
