import {BriefsPanel} from '../../../components/briefs/panel';
import {queryParams,type Query} from '../../../lib/workspace/view';
import {metaTitulo} from '../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.briefs');
export default async function Page({searchParams}:{searchParams:Query}){return <BriefsPanel initialQuery={queryParams(await searchParams).toString()}/>;}
