import {CustomerBindings} from '../../../components/workspace/customer-bindings';
import {EconomicImportWorkspace} from '../../../components/economic-import-workspace';
import {EconomiaResumen} from '../../../components/datos/economia-resumen';
import {workspaceSession} from '../../../lib/workspace/server';
import {economicInitialScope} from '../../../lib/economic-scope';
import {OrderMappings} from '../../../components/workspace/order-mappings';
export const metadata={title:'Dinero · Preparar'};
// Solo `next dev` con VEXA_UI_FIXTURES=1 (auditoría visual local): organización sintética, sin Supabase.
const FIXTURES=process.env.NODE_ENV==='development'&&process.env.VEXA_UI_FIXTURES==='1';
const FIXTURE_TENANT='00000000-0000-4000-8000-000000000001';
/** Claves de alcance que el servicio de lectura acepta; el resto (base, exponente…) solo sirve a los formularios de abajo. */
const ALCANCE=['date_start','date_end','currency','snapshot_id'];
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const raw=await searchParams,query=new URLSearchParams();
 for(const [k,v] of Object.entries(raw))if(typeof v==='string')query.set(k,v);
 const active=FIXTURES?{tenant_id:FIXTURE_TENANT,role:(['owner','analyst','operator','viewer'].includes(String(raw.as))?String(raw.as):'owner')}:(await workspaceSession()).session.active;
 const sc=economicInitialScope(query);
 const lectura=new URLSearchParams();for(const k of ALCANCE){const v=query.get(k);if(v)lectura.set(k,v);}
 const puedePreparar=active.role==='owner'||active.role==='analyst';
 return <EconomiaResumen query={lectura.toString()} puedePreparar={puedePreparar}>
  <EconomicImportWorkspace key={active.tenant_id} tenantId={active.tenant_id} canImport={active.role==='owner'} defaultScope={{start:sc.start+'T00:00:00.000Z',end:sc.end+'T00:00:00.000Z',currency:sc.currency,exponent:sc.exponent,basis:sc.basis,timezone:'UTC',dateBasis:'occurred_at'}}/>
  <OrderMappings/>
  <CustomerBindings/>
 </EconomiaResumen>;
}
