import {idiomaActual} from '../../../lib/i18n/servidor';
import {traductor} from '../../../lib/i18n';
import {ConnectionHealthPanel} from '../../../components/connection-health';
import {ConnectionSettings} from '../../../components/connection-settings';
import {ConexionesResumen} from '../../../components/datos/conexiones-resumen';
import {DatosCabecera} from '../../../components/datos/datos-cabecera';
export const metadata={title:'Fuentes conectadas'};
export default async function ConnectionsPage(){const t=traductor(await idiomaActual());return <section className="task-page connections-page stack"><DatosCabecera actual="fuentes" title={t('fuentes.titulo')} description={t('fuentes.desc')}/><ConexionesResumen/><div className="task-columns" style={{gridTemplateColumns:'minmax(0,1fr)'}}><ConnectionHealthPanel/><ConnectionSettings/></div></section>;}
