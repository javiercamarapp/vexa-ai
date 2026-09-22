import {NextRequest} from 'next/server';
import {workspaceResponse} from '../../../../lib/workspace/server';
export const dynamic='force-dynamic';
export const GET=(request:NextRequest)=>workspaceResponse(request,'export');
