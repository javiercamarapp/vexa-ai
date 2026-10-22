import {NextRequest} from 'next/server';
import {briefResponse} from '../../../lib/briefs/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
// Generar un brief verifica el corte completo (digest, catálogo, evidencia): en frío excede los 60 s por defecto de Vercel.
export const maxDuration=300;
export const GET=(request:NextRequest)=>briefResponse(request);
export const POST=(request:NextRequest)=>briefResponse(request);
