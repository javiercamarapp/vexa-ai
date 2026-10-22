import {NextRequest} from 'next/server';
import {recommendationResponse} from '../../../lib/recommendations/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
// Proponer una recomendación verifica el corte y la evidencia del problema: en frío excede los 60 s por defecto de Vercel.
export const maxDuration=300;
export function GET(request:NextRequest){return recommendationResponse(request);}
export function POST(request:NextRequest){return recommendationResponse(request);}
