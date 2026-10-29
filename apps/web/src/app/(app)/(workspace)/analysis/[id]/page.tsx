import {EvidencePanel} from '../../../../../components/evidence-panel';
import {metaTitulo} from '../../../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.analysis-id');
export default async function EvidencePage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <EvidencePanel key={id} runId={id}/>;}
