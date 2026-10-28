import {NextRequest} from 'next/server';
import {estadoOnboarding} from '../../../../lib/onboarding/servidor';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const GET=(request:NextRequest)=>estadoOnboarding(request);
