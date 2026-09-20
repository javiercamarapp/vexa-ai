import {exportRowErrors} from '../../ingestion/mapping.mjs';
export function createJobsHandler(repository){return async request=>{
 try{
  const path=new URL(request.url).pathname;
  if(path==='/api/jobs/health'&&request.method==='GET'){const data=await repository.health();return Response.json({data},{status:data.healthy?200:503});}
  if(path==='/api/jobs/worker'&&request.method==='POST'){const b=await request.json();return Response.json({data:await repository.setup(b.user_id,b.enabled)});}
  const detail=path.match(/^\/api\/jobs\/([0-9a-f-]{36})\/(errors|canonicals)(?:\/([0-9a-f-]{36}))?$/i);
  if(detail){
   if(detail[2]==='errors'&&request.method==='GET')return new Response(exportRowErrors(await repository.errors(detail[1])),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="ingestion-errors.csv"','Cache-Control':'private, no-store'}});
   let data;
   if(detail[2]==='canonicals'&&request.method==='GET')data=detail[3]?await repository.history(detail[1],detail[3]):await repository.canonicals(detail[1]);
   else if(detail[3]&&request.method==='POST'){
    const b=await request.json();if(Object.keys(b).some(k=>!['revisionId','expectedVersion','reason'].includes(k))||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>1000||!Number.isSafeInteger(b.expectedVersion)||b.expectedVersion<1||! /^[0-9a-f-]{36}$/i.test(b.revisionId))return Response.json({error:{code:'INVALID_SELECTION'}},{status:400});
    data=await repository.history(detail[1],detail[3],b);
   }else return Response.json({error:{code:'METHOD_NOT_ALLOWED'}},{status:405});
   return Response.json({data},{status:data?.status==='conflict'?409:200,headers:{'Cache-Control':'private, no-store'}});
  }
  const m=path.match(/^\/api\/jobs\/([0-9a-f-]{36})(\/(?:cancel|replay))?$/i);if(!m)return Response.json({error:{code:'NOT_FOUND'}},{status:404});
  let data;if(request.method==='GET'&&!m[2])data=await repository.get(m[1]);else if(request.method==='POST'&&m[2])data=await repository[m[2]==='/replay'?'replay':'cancel'](m[1]);else return Response.json({error:{code:'METHOD_NOT_ALLOWED'}},{status:405});
  return Response.json({data},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){const status=[400,401,403,404,409].includes(e.status)?e.status:503;return Response.json({error:{code:status===503?'JOBS_CONFIGURATION_OR_DATABASE_REQUIRED':e.code}},{status,headers:{'Cache-Control':'private, no-store'}});}
};}
