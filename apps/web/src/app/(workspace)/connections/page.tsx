import {ConnectionHealthPanel} from '../../../components/connection-health';
import {ConnectionSettings} from '../../../components/connection-settings';
import {PageHeader} from '../../../components/ui/page-header';
export const metadata={title:'Conexiones'};
export default function ConnectionsPage(){return <section className="task-page connections-page stack"><PageHeader title="Conexiones" description="Revisa tus fuentes y configura la sincronización de cada cuenta autorizada."/><div className="task-columns" style={{gridTemplateColumns:'minmax(0,1fr)'}}><ConnectionHealthPanel/><ConnectionSettings/></div></section>;}
