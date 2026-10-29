import {RovaqCargando} from '../../../components/rovaq-cargando';
import {idiomaActual} from '../../../lib/i18n/servidor';
import {traducir} from '../../../lib/i18n';
export default async function Loading(){return <RovaqCargando mensaje={traducir(await idiomaActual(),'tr.ge.cargandoEspacio')}/>;}
