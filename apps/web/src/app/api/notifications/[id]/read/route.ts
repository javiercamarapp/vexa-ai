import {NextRequest} from 'next/server';
import {notificationResponse} from '../../../../../lib/notifications/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){return notificationResponse(request,{id:(await params).id});}
