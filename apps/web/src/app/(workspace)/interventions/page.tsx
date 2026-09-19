import { WorkspaceView, type Query } from '../../../lib/workspace/view';
export default async function Page(props:{searchParams:Query}){return <WorkspaceView resource="interventions" searchParams={props.searchParams} />;}
