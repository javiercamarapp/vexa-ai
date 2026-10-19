import {NextRequest} from 'next/server';
import {provenance} from '../../../../lib/provenance/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const GET=async(request:NextRequest,context:{params:Promise<{revisionId:string}>})=>provenance(request,'origin',(await context.params).revisionId);
