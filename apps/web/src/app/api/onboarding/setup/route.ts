import {NextRequest} from 'next/server';
import {setupOnboarding} from '../../../../lib/onboarding/setup-servidor';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const GET=(request:NextRequest)=>setupOnboarding(request);
