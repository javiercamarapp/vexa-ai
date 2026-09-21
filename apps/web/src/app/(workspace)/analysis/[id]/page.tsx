import {EvidencePanel} from '../../../../components/evidence-panel';
export default async function EvidencePage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <EvidencePanel key={id} runId={id}/>;}
