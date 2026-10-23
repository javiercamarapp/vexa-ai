import {InterventionsPanel} from '../../../components/interventions/panel';
import {queryParams,type Query} from '../../../lib/workspace/view';
export const metadata={title:'Acciones'};
export default async function Page({searchParams}:{searchParams:Query}){return <InterventionsPanel initialQuery={queryParams(await searchParams).toString()}/>;}
