import {NextRequest} from 'next/server';
import {handleTeam} from '../../../../lib/team/server';
export const runtime='nodejs';
export const GET=(request:NextRequest)=>handleTeam(request,undefined,true);
export const POST=GET;
