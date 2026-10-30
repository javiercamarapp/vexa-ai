import {ImportPreview} from '../../../../components/import-preview';
import {MemberFileLoader} from '../../../../components/member-file-loader';
import {metaTitulo} from '../../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.imports');
export default function ImportsPage(){return <><ImportPreview/><MemberFileLoader/></>;}
