// Wave-2 builder B fixtures: imports, connections and associations so those views show data in the audit.
export function respondExtra(url,method,bodyText,{u}){
 const p=new URL(url,'http://x').pathname;
 const conn=u(3002);
 if(p==='/api/imports'&&method==='GET')return [200,{data:{canConfigure:true,connections:[{id:conn,source:'csv',account_id:'Tracker Excel'},{id:u(3005),source:'hubspot',account_id:'demo-portal'}],reservations:[{id:u(4001),state:'reserved',mapping_version:'interactive-unmapped-v1'}],team_jobs:[
  {id:u(4101),state:'succeeded',created_at:'2026-10-12T15:00:00.000Z',accepted:'13000',rejected:'0',duplicates:'0',account_id:'Tracker Excel'},
  {id:u(4102),state:'partial',created_at:'2026-10-06T12:00:00.000Z',accepted:'857',rejected:'1',duplicates:'0',account_id:'Pedidos CSV'}],next_offset:null,next_connection_offset:null,next_team_offset:null}}];
 if(p==='/api/connections'&&method==='GET')return [200,{connections:[
  {id:conn,source:'hubspot',accountId:'demo-portal',connectionStatus:'active',state:'partial',lastAttempt:'2026-10-19T03:00:00.000Z',lastSuccess:null,watermark:{kind:'checkpoint_hash',value:'a1b2c3d4e5f6'},coverage:{observed:420000,accepted:371500,rejected:5299},lagSeconds:null,lagBasis:'time_since_success',permissions:'available',errorCode:null,reconnect:null},
  {id:u(3007),source:'csv',accountId:'Pedidos CSV',connectionStatus:'active',state:'unknown',lastAttempt:null,lastSuccess:null,watermark:null,coverage:null,lagSeconds:null,lagBasis:'time_since_success',permissions:'unknown',errorCode:null,reconnect:null},
  {id:u(3008),source:'xlsx',accountId:'Tracker Excel',connectionStatus:'active',state:'unknown',lastAttempt:null,lastSuccess:null,watermark:null,coverage:null,lagSeconds:null,lagBasis:'time_since_success',permissions:'unknown',errorCode:null,reconnect:null},
  {id:u(3005),source:'zendesk',accountId:'soporte-mx',connectionStatus:'active',state:'reconnect_required',lastAttempt:'2026-10-17T10:00:00.000Z',lastSuccess:null,watermark:null,coverage:null,lagSeconds:null,lagBasis:'time_since_success',permissions:'revoked',errorCode:'RECONNECT_REQUIRED',reconnect:{ownerRequired:true,canRequest:true,attemptId:u(3006),steps:['Rota la credencial en Zendesk','Guarda el nuevo nombre de credencial','Permite un nuevo intento']}}]}];
 if(p==='/api/connections/settings'&&method==='GET')return [200,{canConfigure:true,settings:[{connectionId:conn,source:'hubspot',accountId:'demo-portal',credentialRef:'hs-demo',historyFrom:'2026-01-01T00:00:00.000Z',enabled:true,overlapSeconds:60,pollSeconds:300,version:1,errorCode:null,failureCount:0}]}];
 if(/^\/api\/jobs\/0{8}-0{4}-4000-8000-000000000404$/.test(p)&&method==='GET')return [404,{error:{code:'JOB_NOT_FOUND'}}];
 if(/^\/api\/jobs\/[0-9a-f-]{36}$/.test(p)&&method==='GET')return [200,{data:{can_select:false,id:p.split('/').pop(),state:'succeeded',checkpoint:12446,counters:{total:'12446',accepted:'12446',rejected:'0',duplicates:'0',pending:'0'},last_progress_at:'2026-10-19T04:37:31.595Z'}}];
 if(p==='/api/team'&&method==='GET'){const me=u(5001);return [200,{viewerId:me,data:{nextCursor:null,items:[
  {id:me,email:'propietario@cliente.com',role:'owner',status:'active',version:1},
  {id:u(5002),email:'analista@cliente.com',role:'analyst',status:'active',version:2},
  {id:u(5003),email:'worker-5b000ff068@vexa.invalid',role:'analyst',status:'active',version:1}]}}];}
 return null;
}
