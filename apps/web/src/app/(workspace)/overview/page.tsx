import {SharedWorkspacePanel} from '../../../components/workspace/shared-panel';
import {HoyPantalla} from '../../../components/hoy/hoy-pantalla';
import {queryParams,type Query} from '../../../lib/workspace/view';
export const metadata={title:'Hoy'};
// Hoy ocupa el primer pliegue; debajo sigue el resumen del corte publicado (pedidos, reembolsos y conversaciones cargadas) con su alcance y filtros.
export default async function Page({searchParams}:{searchParams:Query}){const query=queryParams(await searchParams).toString();return <div className="stack"><HoyPantalla/><SharedWorkspacePanel key="metrics" resource="metrics" initialQuery={query}/></div>;}
