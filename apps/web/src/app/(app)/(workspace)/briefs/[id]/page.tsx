import {BriefsPanel} from '../../../../../components/briefs/panel';
import {queryParams,type Query} from '../../../../../lib/workspace/view';
import {metaTitulo} from '../../../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.briefs-id');
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Query}){return <BriefsPanel initialId={(await params).id} initialQuery={queryParams(await searchParams).toString()}/>;}
