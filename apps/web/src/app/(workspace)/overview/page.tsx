import {WorkspaceView,type Query} from '../../../lib/workspace/view';
import {EconomicPanel} from '../../../components/economic-panel';
export default async function Page(props:{searchParams:Query}){return <><WorkspaceView resource="metrics" searchParams={props.searchParams}/><EconomicPanel/></>;}
