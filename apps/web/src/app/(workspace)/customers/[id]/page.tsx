import {FinancialDetailPanel} from '../../../../components/workspace/detail-panel';
import {queryParams,type Query} from '../../../../lib/workspace/view';
import {metaTitulo} from '../../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.customers-id');
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Query}){const {id}=await params;return <FinancialDetailPanel key={'customer:'+id} kind="customer" id={id} initialQuery={queryParams(await searchParams).toString()}/>;}
