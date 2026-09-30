import {NextRequest} from 'next/server';
import {handlePlatform} from '../../../lib/platform/server';
export const runtime='nodejs';
export const GET=(request:NextRequest)=>handlePlatform(request);
export const POST=GET;
