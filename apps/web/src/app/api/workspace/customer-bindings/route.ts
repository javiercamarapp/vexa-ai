import {NextRequest} from 'next/server';
import {detailResponse} from '../../../../lib/workspace/detail-server';
import {boundedWorkspaceGet} from '../mappings/bounded';
export const dynamic='force-dynamic';
export const GET=(request:NextRequest)=>boundedWorkspaceGet(request,'customers');
export const POST=(request:NextRequest)=>detailResponse(request);
