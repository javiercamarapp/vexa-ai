import {ConnectionHealthPanel} from '../../../components/connection-health';
import {ConnectionSettings} from '../../../components/connection-settings';
import {ConexionesResumen} from '../../../components/datos/conexiones-resumen';
import {DatosCabecera} from '../../../components/datos/datos-cabecera';
export const metadata={title:'Fuentes conectadas'};
export default function ConnectionsPage(){return <section className="task-page connections-page stack"><DatosCabecera actual="fuentes" title="Fuentes conectadas" description="Qué está conectado, con qué permisos y cuándo se sincronizó por última vez; todo en solo lectura."/><ConexionesResumen/><div className="task-columns" style={{gridTemplateColumns:'minmax(0,1fr)'}}><ConnectionHealthPanel/><ConnectionSettings/></div></section>;}
