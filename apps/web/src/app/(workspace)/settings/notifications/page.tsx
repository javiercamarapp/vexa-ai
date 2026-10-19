import {NotificationPanel} from '../../../../components/notifications/panel';
import {workspaceSession} from '../../../../lib/workspace/server';
export const metadata={title:'Preferencias de avisos'};
export default async function Page(){const {session}=await workspaceSession();return <NotificationPanel key={session.user.id+':'+session.active.tenant_id} settings/>;}
