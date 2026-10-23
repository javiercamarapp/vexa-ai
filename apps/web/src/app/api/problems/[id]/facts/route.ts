import {NextRequest} from 'next/server';
import {problemFacts} from '../../../../../lib/problems/facts-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const GET=async(request:NextRequest,context:{params:Promise<{id:string}>})=>problemFacts(request,(await context.params).id);
