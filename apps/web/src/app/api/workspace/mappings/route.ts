import {NextRequest} from 'next/server';
import {workspaceResponse} from '../../../../lib/workspace/server';
import {boundedWorkspaceGet} from './bounded';
export const dynamic='force-dynamic';
export const GET=(request:NextRequest)=>boundedWorkspaceGet(request,'mappings');
export const POST=(request:NextRequest)=>workspaceResponse(request,'mappings');
