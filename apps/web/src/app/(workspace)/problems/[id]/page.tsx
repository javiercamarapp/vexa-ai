import {ProblemsPanel} from '../../../../components/problems-panel';
import {CauseEvidence} from '../../../../components/cause-evidence';
import {FinancialDetailPanel} from '../../../../components/workspace/detail-panel';
import {queryParams,type Query} from '../../../../lib/workspace/view';
export const metadata={title:'Detalle del problema'};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Query}){const {id}=await params;const query=queryParams(await searchParams).toString();return <FinancialDetailPanel key={'financial:'+id} kind="problem" id={id} initialQuery={query}>
 <div className="detail-extras"><details className="card detail-admin"><summary>Evaluación causal y pruebas operativas</summary><CauseEvidence key={'cause:'+id} problemId={id}/></details>
 <details className="card detail-admin"><summary>Agrupación y revisión humana del problema</summary><ProblemsPanel key={id} problemId={id}/></details></div>
</FinancialDetailPanel>;}
