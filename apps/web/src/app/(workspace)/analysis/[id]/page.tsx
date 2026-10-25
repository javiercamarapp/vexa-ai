import {EvidencePanel} from '../../../../components/evidence-panel';
export const metadata={title:'Detalle del análisis'};
export default async function EvidencePage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <EvidencePanel key={id} runId={id}/>;}
