// Fixtures SINTÉTICOS de Retención y borrado (/api/recovery). Todo ficticio.
export async function respondExtra(url,method,bodyText,{u}){
 const x=new URL(url,'http://x'),p=x.pathname,q=x.searchParams;
 if(p==='/api/notifications'&&method==='GET'){const st=q.get('status')==='all'?'all':'unread',all=[{id:u(9001),title:'Una acción espera tu revisión',body:'Se te ha asignado una intervención. Revisa su objetivo y la evidencia antes de registrar una acción.',createdAt:'2026-10-23T14:05:00.000Z',readAt:null,href:'/recommendations'},{id:u(9002),title:'Revisa el estado de tu conexión',body:'Una conexión de tu organización necesita revisión.',createdAt:'2026-10-22T09:30:00.000Z',readAt:null,href:'/connections'},{id:u(9003),title:'Las prioridades, en un solo lugar',body:'Hay un brief disponible para tu equipo.',createdAt:'2026-10-20T16:00:00.000Z',readAt:'2026-10-20T17:10:00.000Z',href:'/briefs'}];const items=st==='all'?all:all.filter(i=>!i.readAt);return [200,{contract_version:'f06-notifications-v1',data:{status:st,items,unreadCount:2,nextCursor:null,limit:25}}];}
 if(p!=='/api/recovery')return null;
 if(method==='POST')return [200,{ok:true}];
 if(q.get('connectionId'))return [200,{items:[{id:u(8101),externalId:'conv-000118'},{id:u(8102),externalId:'conv-000119'}],nextCursor:null}];
 return [200,{ready:true,policy:{version:2,backupTtlSeconds:2592000},connections:[{id:u(8001),source:'hubspot',accountId:'demo-portal'},{id:u(8002),source:'csv',accountId:'Pedidos CSV'}],
  artifacts:[{id:u(8201),class:'raw_csv',path:'imports/2026-10/pedidos-0001.csv',status:'pending'},{id:u(8202),class:'raw_csv',path:'imports/2026-09/pedidos-0002.csv',status:'deleted'},{id:u(8203),class:'backup',path:'backups/2026-10-12/ledger.json',status:'retained'}],counts:{pending:1,deleted:1}}];
}
