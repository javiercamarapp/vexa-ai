// Regional routing and unrestricted processing are distinct explicit policies.
const origins=Object.freeze({unrestricted:'https://openrouter.ai',US:'https://us.openrouter.ai',EU:'https://eu.openrouter.ai',us:'https://us.openrouter.ai',eu:'https://eu.openrouter.ai'});
export function residencyEligible(policy,candidate,now){
 if(!Object.hasOwn(origins,policy?.residency)||candidate?.residency!==policy.residency)return false;
 const attestation=candidate.privacyAttestation;
 if(policy.residency==='unrestricted')return attestation?.residencyEnforced!==true;
 return attestation?.residencyEnforced===true&&typeof attestation.version==='string'&&!!attestation.version&&Date.parse(attestation.expiresAt)>now;
}
export function residencyEndpoint(policy,kind){
 if(!Object.hasOwn(origins,policy?.residency)||!['chat/completions','embeddings'].includes(kind))return null;
 return origins[policy.residency]+'/api/v1/'+kind;
}
