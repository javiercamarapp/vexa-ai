import {NextRequest} from 'next/server';
import {explorerResponse} from '../../../lib/explorer/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export function GET(request:NextRequest){return explorerResponse(request,'search');}
