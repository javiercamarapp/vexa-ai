// Wave-2 builder B fixtures: imports, connections and associations so those views show data in the audit.
export function respondExtra(url,method,bodyText,{u}){
 const p=new URL(url,'http://x').pathname;
 const conn=u(3002);
 if(p==='/api/imports'&&method==='GET')return [200,{data:{canConfigure:true,connections:[{id:conn,source:'csv',account_id:'Tracker Excel'},{id:u(3005),source:'hubspot',account_id:'demo-portal'}],reservations:[{id:u(4001),state:'reserved',mapping_version:'interactive-unmapped-v1'}],team_jobs:[
  {id:u(4101),state:'succeeded',created_at:'2026-10-12T15:00:00.000Z',accepted:'13228',rejected:'0',duplicates:'0',account_id:'Tracker Excel'},
  {id:u(4102),state:'partial',created_at:'2026-10-06T12:00:00.000Z',accepted:'857',rejected:'1',duplicates:'0',account_id:'Pedidos CSV'}],next_offset:null,next_connection_offset:null,next_team_offset:null}}];
 if(p==='/api/connections'&&method==='GET')return [200,{connections:[
  {id:conn,source:'hubspot',accountId:'demo-portal',connectionStatus:'active',state:'healthy',lastAttempt:'2026-10-19T03:00:00.000Z',lastSuccess:'2026-10-19T03:00:00.000Z',watermark:{kind:'checkpoint_hash',value:'a1b2c3d4e5f6'},coverage:{observed:420000,accepted:371500,rejected:5299},lagSeconds:1800,lagBasis:'time_since_success',permissions:'available',errorCode:null,reconnect:null},
  {id:u(3005),source:'zendesk',accountId:'soporte-mx',connectionStatus:'active',state:'reconnect_required',lastAttempt:'2026-10-17T10:00:00.000Z',lastSuccess:null,watermark:null,coverage:null,lagSeconds:null,lagBasis:'time_since_success',permissions:'revoked',errorCode:'RECONNECT_REQUIRED',reconnect:{ownerRequired:true,canRequest:true,attemptId:u(3006),steps:['Rota la credencial en Zendesk','Guarda el nuevo nombre de credencial','Permite un nuevo intento']}}]}];
 if(p==='/api/connections/settings'&&method==='GET')return [200,{canConfigure:true,settings:[{connectionId:conn,source:'hubspot',accountId:'demo-portal',credentialRef:'hs-demo',historyFrom:'2026-01-01T00:00:00.000Z',enabled:true,overlapSeconds:60,pollSeconds:300,version:1,errorCode:null,failureCount:0}]}];
 return null;
}
