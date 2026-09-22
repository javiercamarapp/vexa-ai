import {NextRequest} from 'next/server';
import {recommendationResponse} from '../../../../lib/recommendations/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
async function handle(request:NextRequest,context:{params:Promise<{id:string}>}){return recommendationResponse(request,await context.params);}
export const GET=handle;export const POST=handle;
