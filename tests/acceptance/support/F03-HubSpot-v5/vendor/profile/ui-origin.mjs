export function nativeUiIdentity(base){
 let u;try{u=new URL(base);}catch{throw Error('UI_THREAD_URL_BINDING');}
 const path=/^\/help-desk\/([1-9][0-9]*)\/view\/search\/ticket\/([1-9][0-9]*)\/thread\/([1-9][0-9]*)$/.exec(u.pathname);
 if(u.origin!=='https://app.hubspot.com'||u.username||u.password||!path||[...u.searchParams.keys()].some(k=>k!=='query'||u.searchParams.getAll(k).length!==1))throw Error('UI_THREAD_URL_BINDING');
 return Object.freeze({account:path[1],ticket:path[2],thread:path[3]});
}
