import {NextRequest} from 'next/server';
import {emailAuth} from '../../../../lib/email-auth/server';
export const runtime='nodejs';
export const POST=(request:NextRequest)=>emailAuth(request,'session');
