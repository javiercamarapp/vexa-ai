import {RecommendationsPanel} from '../../../../components/recommendations/panel';
import {queryParams,type Query} from '../../../../lib/workspace/view';
import {metaTitulo} from '../../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.recommendations');
export default async function Page({searchParams}:{searchParams:Query}){return <RecommendationsPanel initialQuery={queryParams(await searchParams).toString()} vista="por-decidir"/>;}
