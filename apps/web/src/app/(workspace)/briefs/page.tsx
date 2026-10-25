import {BriefsPanel} from '../../../components/briefs/panel';
import {queryParams,type Query} from '../../../lib/workspace/view';
export const metadata={title:'Informe ejecutivo'};
export default async function Page({searchParams}:{searchParams:Query}){return <BriefsPanel initialQuery={queryParams(await searchParams).toString()}/>;}
