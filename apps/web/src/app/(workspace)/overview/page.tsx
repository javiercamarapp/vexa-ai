import {SharedWorkspacePanel} from '../../../components/workspace/shared-panel';
import {HoyPantalla} from '../../../components/hoy/hoy-pantalla';
import {ChecklistHoy} from '../../../components/onboarding/checklist';
import {queryParams,type Query} from '../../../lib/workspace/view';
export const metadata={title:'Hoy'};
// Hoy ocupa el primer pliegue; debajo van la lista de primeros pasos (carga diferida, según el rol) y el resumen del corte publicado (pedidos, reembolsos y conversaciones cargadas) con su alcance y filtros.
export default async function Page({searchParams}:{searchParams:Query}){const query=queryParams(await searchParams).toString();return <div className="stack hoy-page"><HoyPantalla/><ChecklistHoy/><SharedWorkspacePanel key="metrics" resource="metrics" initialQuery={query}/></div>;}
