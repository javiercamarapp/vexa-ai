import {SoloInterno} from '../../../../components/workspace/access';
import {CandidatesPanel} from '../../../../components/candidates-panel';
import {metaTitulo} from '../../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.evaluation-candidates');
export default function Page(){return <SoloInterno><CandidatesPanel/></SoloInterno>;}
