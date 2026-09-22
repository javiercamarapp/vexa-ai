import {FinancialDetailPanel} from '../../../../components/workspace/detail-panel';
import {queryParams,type Query} from '../../../../lib/workspace/view';
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Query}){const {id}=await params;return <FinancialDetailPanel key={'customer:'+id} kind="customer" id={id} initialQuery={queryParams(await searchParams).toString()}/>;}
