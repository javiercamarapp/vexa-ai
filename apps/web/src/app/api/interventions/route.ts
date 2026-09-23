import {NextRequest} from 'next/server';
import {interventionResponse} from '../../../lib/interventions/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){return interventionResponse(request);}
