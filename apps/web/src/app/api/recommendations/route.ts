import {NextRequest} from 'next/server';
import {recommendationResponse} from '../../../lib/recommendations/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export function GET(request:NextRequest){return recommendationResponse(request);}
export function POST(request:NextRequest){return recommendationResponse(request);}
