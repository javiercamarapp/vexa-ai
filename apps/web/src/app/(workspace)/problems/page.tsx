import {SharedWorkspacePanel} from '../../../components/workspace/shared-panel';
import {queryParams,type Query} from '../../../lib/workspace/view';
import {metaTitulo} from '../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.problems');
export default async function Page({searchParams}:{searchParams:Query}){const query=queryParams(await searchParams).toString();return <SharedWorkspacePanel key="problems" resource="problems" initialQuery={query}/>;}
