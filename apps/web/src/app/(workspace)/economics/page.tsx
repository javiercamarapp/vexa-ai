import {CustomerBindings} from '../../../components/workspace/customer-bindings';
import {EconomicImportWorkspace} from '../../../components/economic-import-workspace';
import {workspaceSession} from '../../../lib/workspace/server';
import {economicInitialScope} from '../../../lib/economic-scope';
import {OrderMappings} from '../../../components/workspace/order-mappings';
export const metadata={title:'Gestión económica'};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const {session}=await workspaceSession();const raw=await searchParams,query=new URLSearchParams();for(const [k,v] of Object.entries(raw))if(typeof v==='string')query.set(k,v);const sc=economicInitialScope(query);return <><h1>Gestión económica</h1><p>Registra fuentes y evidencia, revisa importes y publica snapshots para las vistas ejecutivas.</p><EconomicImportWorkspace key={session.active.tenant_id} tenantId={session.active.tenant_id} canImport={session.active.role==='owner'} defaultScope={{start:sc.start+'T00:00:00.000Z',end:sc.end+'T00:00:00.000Z',currency:sc.currency,exponent:sc.exponent,basis:sc.basis,timezone:'UTC',dateBasis:'occurred_at'}}/><OrderMappings/><CustomerBindings/></>;}
