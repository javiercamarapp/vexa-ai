import {NextRequest} from 'next/server';
import {notificationResponse} from '../../../../lib/notifications/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=(request:NextRequest)=>notificationResponse(request,{preferences:true});
export const POST=(request:NextRequest)=>notificationResponse(request,{preferences:true});
