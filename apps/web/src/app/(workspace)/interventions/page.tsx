import {RecommendationsPanel} from '../../../components/recommendations/panel';
import {vistaDe} from '../../../components/interventions/acciones-tabs';
import {queryParams,type Query} from '../../../lib/workspace/view';
export const metadata={title:'Acciones'};
/** Alias de /recommendations: la misma pantalla de Acciones con la pestaña En curso (por omisión) o Resultados (?vista=). */
export default async function Page({searchParams}:{searchParams:Query}){const q=queryParams(await searchParams).toString();return <RecommendationsPanel initialQuery={q} vista={vistaDe(q)??'en-curso'}/>;}
