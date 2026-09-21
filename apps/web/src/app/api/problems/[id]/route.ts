import {NextRequest} from 'next/server';
import {problems} from '../../../../lib/problems/server';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,context:{params:Promise<{id:string}>}){return problems(request,(await context.params).id);}
