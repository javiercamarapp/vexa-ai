import {PushPreferences} from '../../../../components/notifications/push-preferences';
import {workspaceSession} from '../../../../lib/workspace/server';
import {conRedireccionDeAcceso} from '../../../../lib/workspace/acceso-pagina';
export const metadata={title:'Avisos en el dispositivo · Rovaq AI',manifest:'/push-manifest.webmanifest'};
export default async function Page(){const {session}=await conRedireccionDeAcceso(workspaceSession);return <PushPreferences key={session.user.id+':'+session.active.tenant_id}/>;}
