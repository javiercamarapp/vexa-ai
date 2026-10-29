import {ExplorerPanel} from '../../../components/explorer/panel';
import {queryParams,type Query} from '../../../lib/workspace/view';
import {metaTitulo} from '../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.explorer');
export default async function Page({searchParams}:{searchParams:Query}){return <ExplorerPanel initialQuery={queryParams(await searchParams).toString()}/>;}
