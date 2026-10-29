import {ImportPreview} from '../../../../components/import-preview';
import {metaTitulo} from '../../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.imports');
export default function ImportsPage(){return <ImportPreview/>;}
