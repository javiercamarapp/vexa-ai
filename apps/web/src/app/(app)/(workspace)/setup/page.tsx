import {SetupPantalla} from '../../../../components/onboarding/setup-pantalla';
import {metaTitulo} from '../../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.setup');
export default function Page(){return <SetupPantalla/>;}
