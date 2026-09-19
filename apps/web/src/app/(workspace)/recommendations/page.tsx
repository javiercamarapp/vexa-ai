import { WorkspaceView, type Query } from '../../../lib/workspace/view';
export default async function Page(props:{searchParams:Query}){return <WorkspaceView resource="recommendations" searchParams={props.searchParams} />;}
