import {InterventionsPanel} from '../../../components/interventions/panel';
import {queryParams,type Query} from '../../../lib/workspace/view';
export default async function Page({searchParams}:{searchParams:Query}){return <InterventionsPanel initialQuery={queryParams(await searchParams).toString()}/>;}
