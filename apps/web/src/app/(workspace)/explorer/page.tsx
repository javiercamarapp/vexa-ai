import {ExplorerPanel} from '../../../components/explorer/panel';
import {queryParams,type Query} from '../../../lib/workspace/view';
export const metadata={title:'Explorador de evidencia'};
export default async function Page({searchParams}:{searchParams:Query}){return <ExplorerPanel initialQuery={queryParams(await searchParams).toString()}/>;}
