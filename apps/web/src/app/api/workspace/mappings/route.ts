import {NextRequest} from 'next/server';
import {workspaceResponse} from '../../../../lib/workspace/server';
export const dynamic='force-dynamic';
export const GET=(request:NextRequest)=>workspaceResponse(request,'mappings');
export const POST=(request:NextRequest)=>workspaceResponse(request,'mappings');
