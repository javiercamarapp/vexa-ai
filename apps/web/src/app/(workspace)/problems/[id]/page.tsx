import { WorkspaceView, type Query } from '../../../../lib/workspace/view';
export default async function Page(props:{searchParams:Query;params:Promise<{id:string}>}){return <WorkspaceView resource="problems" searchParams={props.searchParams} id={(await props.params).id}/>;}
