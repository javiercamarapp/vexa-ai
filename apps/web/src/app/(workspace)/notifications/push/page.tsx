import {PushPreferences} from '../../../../components/notifications/push-preferences';
import {workspaceSession} from '../../../../lib/workspace/server';
export const metadata={title:'Avisos en el dispositivo · VEXA',manifest:'/push-manifest.webmanifest'};
export default async function Page(){const {session}=await workspaceSession();return <PushPreferences key={session.user.id+':'+session.active.tenant_id}/>;}
