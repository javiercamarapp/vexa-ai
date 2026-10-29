import {SoloInterno} from '../../../../components/workspace/access';
import {EvaluationPanel} from '../../../../components/evaluation-panel';
import {metaTitulo} from '../../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.evaluation');
export default function EvaluationPage(){return <SoloInterno><EvaluationPanel/></SoloInterno>;}
