import {FuentesDatos} from '../../../components/datos/fuentes-datos';
import {metaTitulo} from '../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.sources');
export default function SourcesPage(){return <FuentesDatos/>;}
