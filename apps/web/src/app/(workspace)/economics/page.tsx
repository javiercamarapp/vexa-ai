import {CustomerBindings} from '../../../components/workspace/customer-bindings';
import {EconomicImportWorkspace} from '../../../components/economic-import-workspace';
import {workspaceSession} from '../../../lib/workspace/server';
import {OrderMappings} from '../../../components/workspace/order-mappings';
export default async function Page(){const {session}=await workspaceSession();return <><h1>Gestión económica</h1><p>Registra fuentes y evidencia, revisa importes y publica snapshots para las vistas ejecutivas.</p><EconomicImportWorkspace key={session.active.tenant_id} tenantId={session.active.tenant_id} canImport={session.active.role==='owner'}/><OrderMappings/><CustomerBindings/></>;}
