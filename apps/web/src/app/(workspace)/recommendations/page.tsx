import {RecommendationsPanel} from '../../../components/recommendations/panel';
import {queryParams,type Query} from '../../../lib/workspace/view';
export const metadata={title:'Recomendaciones'};
export default async function Page({searchParams}:{searchParams:Query}){return <RecommendationsPanel initialQuery={queryParams(await searchParams).toString()}/>;}
