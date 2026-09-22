import {NextRequest} from 'next/server';
import {detailResponse} from '../../../../../../lib/workspace/detail-server';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,context:{params:Promise<{kind:string;id:string}>}){return detailResponse(request,await context.params);}
