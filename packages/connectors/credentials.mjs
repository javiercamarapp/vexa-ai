const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const fail=()=>{throw Object.assign(Error('CRM_CREDENTIAL_CONFIGURATION_REQUIRED'),{code:'CRM_CREDENTIAL_CONFIGURATION_REQUIRED'});};
/** Server secret configuration. Each reference is bound to one tenant/provider/account. */
export function createCRMCredentialResolver(raw){
 let entries;try{entries=JSON.parse(raw);}catch{entries=[];}
 if(!Array.isArray(entries)||entries.length>1000)fail();
 const lookup=new Map();
 for(const row of entries){
  if(!row||!uuid(row.tenantId)||!['hubspot','zendesk'].includes(row.source)||typeof row.accountId!=='string'||!row.accountId||typeof row.ref!=='string'||!/^[a-zA-Z0-9_.:-]{1,120}$/.test(row.ref)||typeof row.token!=='string'||!row.token.trim()||/[\r\n]/.test(row.token))fail();
  const key=JSON.stringify([row.tenantId,row.ref]);if(lookup.has(key))fail();
  if(row.source==='zendesk'&&(typeof row.subdomain!=='string'||!/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/.test(row.subdomain)))fail();
  if(row.source==='hubspot'&&(!Array.isArray(row.scopes)||row.scopes.some(v=>typeof v!=='string'||!v)))fail();
  lookup.set(key,Object.freeze({tenantId:row.tenantId,ref:row.ref,source:row.source,accountId:row.accountId,token:row.token,subdomain:row.subdomain,scopes:row.scopes?Object.freeze([...row.scopes]):undefined}));
 }
 return ({tenantId,source,accountId,credentialRef})=>{
  if(typeof window!=='undefined')fail();const row=lookup.get(JSON.stringify([tenantId,credentialRef]));if(!row||row.source!==source||row.accountId!==accountId)fail();
  return source==='hubspot'?{token:row.token,version:'v3',scopes:[...row.scopes]}:{token:row.token,subdomain:row.subdomain};
 };
}
