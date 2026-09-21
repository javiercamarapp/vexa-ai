import {ProblemsPanel} from '../../../../components/problems-panel';
export default async function Page({params}:{params:Promise<{id:string}>}){return <ProblemsPanel key={(await params).id} problemId={(await params).id}/>;}
