import {ProblemsPanel} from '../../../../components/problems-panel';
import {CauseEvidence} from '../../../../components/cause-evidence';
import {FinancialDetailPanel} from '../../../../components/workspace/detail-panel';
import {queryParams,type Query} from '../../../../lib/workspace/view';
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Query}){const {id}=await params;const query=queryParams(await searchParams).toString();return <FinancialDetailPanel key={'financial:'+id} kind="problem" id={id} initialQuery={query}><ProblemsPanel key={id} problemId={id}/><CauseEvidence key={'cause:'+id} problemId={id}/></FinancialDetailPanel>;}
