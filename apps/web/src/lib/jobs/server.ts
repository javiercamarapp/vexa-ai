import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
import {createJobRepository} from '../../../../../packages/jobs/durable/repository.mjs';
import {createJobsHandler} from '../../../../../packages/jobs/durable/api.mjs';
export async function jobs(request:NextRequest){
 let finish=(r:NextResponse)=>r;
 try{const c=config();if(!c)throw new AccessError(503,'configuration_required');if(request.method!=='GET')assertOrigin(request.headers.get('origin'),c.origin);const auth=requestAuth(request);finish=auth.finish;const database=createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value});const response=await createJobsHandler(createJobRepository({database}))(request);return finish(new NextResponse(response.body,{status:response.status,headers:response.headers}));}
 catch(e){const status=e instanceof AccessError?e.status:503;return finish(NextResponse.json({error:{code:'jobs_unavailable'}},{status,headers:PRIVATE_HEADERS}));}
}
