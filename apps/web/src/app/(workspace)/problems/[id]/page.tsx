import {ProblemsPanel} from '../../../../components/problems-panel';
import {CauseEvidence} from '../../../../components/cause-evidence';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <><ProblemsPanel key={id} problemId={id}/><CauseEvidence key={'cause:'+id} problemId={id}/></>;}
