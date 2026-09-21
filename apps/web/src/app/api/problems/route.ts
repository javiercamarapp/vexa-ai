import {NextRequest} from 'next/server';
import {problems} from '../../../lib/problems/server';
export const dynamic='force-dynamic';
export const GET=(request:NextRequest)=>problems(request);
export const POST=(request:NextRequest)=>problems(request);
