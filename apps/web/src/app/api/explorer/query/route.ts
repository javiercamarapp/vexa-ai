import {NextRequest} from 'next/server';
import {explorerResponse} from '../../../../lib/explorer/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export function POST(request:NextRequest){return explorerResponse(request,'query');}
