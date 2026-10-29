import {SharedWorkspacePanel} from '../../../components/workspace/shared-panel';
import {HoyPantalla} from '../../../components/hoy/hoy-pantalla';
import {HoyPorRol} from '../../../components/hoy/hoy-rol';
import {ChecklistHoy} from '../../../components/onboarding/checklist';
import {queryParams,type Query} from '../../../lib/workspace/view';
import {metaTitulo} from '../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.overview');
// Propietario y analista ven las cuatro cifras; operador y lector ven lo que su rol puede leer (sin consultar endpoints de dinero). Hoy ocupa el primer pliegue; debajo van la lista de primeros pasos (carga diferida, según el rol) y el resumen del corte publicado (pedidos, reembolsos y conversaciones cargadas) con su alcance y filtros.
export default async function Page({searchParams}:{searchParams:Query}){const query=queryParams(await searchParams).toString();return <div className="stack hoy-page"><HoyPorRol completa={<HoyPantalla/>}/><ChecklistHoy/><SharedWorkspacePanel key="metrics" resource="metrics" initialQuery={query}/></div>;}
