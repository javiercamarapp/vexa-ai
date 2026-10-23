import {ConnectionHealthPanel} from '../../../components/connection-health';
import {ConnectionSettings} from '../../../components/connection-settings';
import {CoberturaConexiones} from '../../../components/datos/cobertura-conexiones';
import {PageHeader} from '../../../components/ui/page-header';
export const metadata={title:'Fuentes de datos'};
export default function ConnectionsPage(){return <section className="task-page connections-page stack"><PageHeader title="Fuentes de datos" description="Revisa tus fuentes y configura la sincronización de cada cuenta autorizada."/><CoberturaConexiones/><div className="task-columns" style={{gridTemplateColumns:'minmax(0,1fr)'}}><ConnectionHealthPanel/><ConnectionSettings/></div></section>;}
