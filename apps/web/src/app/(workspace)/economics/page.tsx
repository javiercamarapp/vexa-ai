import {CustomerBindings} from '../../../components/workspace/customer-bindings';
import {EconomicImportWorkspace} from '../../../components/economic-import-workspace';
import {EconomiaResumen} from '../../../components/datos/economia-resumen';
import {workspaceSession} from '../../../lib/workspace/server';
import {conRedireccionDeAcceso} from '../../../lib/workspace/acceso-pagina';
import {economicInitialScope} from '../../../lib/economic-scope';
import {OrderMappings} from '../../../components/workspace/order-mappings';
import {metaTitulo} from '../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.economics');
// Solo `next dev` con VEXA_UI_FIXTURES=1 (auditoría visual local): organización sintética, sin Supabase.
const FIXTURES=process.env.NODE_ENV==='development'&&process.env.VEXA_UI_FIXTURES==='1';
const FIXTURE_TENANT='00000000-0000-4000-8000-000000000001';
/** Claves de alcance que el servicio de lectura acepta; el resto (base, exponente…) solo sirve a los formularios de abajo. */
const ALCANCE=['date_start','date_end','currency','basis','exponent','timezone','date_basis'];
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const raw=await searchParams,query=new URLSearchParams();
 for(const [k,v] of Object.entries(raw))if(typeof v==='string')query.set(k,v);
 const active=FIXTURES?{tenant_id:FIXTURE_TENANT,role:(['owner','analyst','operator','viewer'].includes(String(raw.as))?String(raw.as):'owner')}:(await conRedireccionDeAcceso(workspaceSession)).session.active;
 const sc=economicInitialScope(query);
 const lectura=new URLSearchParams();for(const k of ALCANCE){const v=query.get(k);if(v)lectura.set(k,v);}
 for(const k of ['sku','source'])for(const v of query.getAll(k))lectura.append(k,v);
 // Sin periodo en la URL se usa el alcance inicial de esta pantalla (12 meses, base de marketplace: la de los cortes publicados) y no el mes en curso con base «net» que asume el servidor.
 if(!lectura.has('date_start')||!lectura.has('date_end')){lectura.set('date_start',sc.start);lectura.set('date_end',sc.end);lectura.set('currency',sc.currency);lectura.set('exponent',String(sc.exponent));lectura.set('basis',sc.basis);}
 // El servidor exige propietario para preparar, cargar, clasificar, asociar y publicar (snapshot_owner_required): el analista solo revisa.
 const puedePreparar=active.role==='owner',soloPropietario=active.role==='analyst';
 return <EconomiaResumen query={lectura.toString()} puedePreparar={puedePreparar} soloPropietario={soloPropietario}>
  <EconomicImportWorkspace key={active.tenant_id} tenantId={active.tenant_id} canImport={active.role==='owner'} defaultScope={{start:sc.start+'T00:00:00.000Z',end:sc.end+'T00:00:00.000Z',currency:sc.currency,exponent:sc.exponent,basis:sc.basis,timezone:'UTC',dateBasis:'occurred_at'}}/>
  <OrderMappings/>
  <CustomerBindings/>
 </EconomiaResumen>;
}
