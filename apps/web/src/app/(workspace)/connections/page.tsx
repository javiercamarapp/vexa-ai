import {ConnectionHealthPanel} from '../../../components/connection-health';
import {ConnectionSettings} from '../../../components/connection-settings';
export default function ConnectionsPage(){return <section className="task-page connections-page"><p className="eyebrow">Fuentes de información</p><h1>Conexiones</h1><p className="intro">Revisa tus fuentes y configura la sincronización de cada cuenta autorizada.</p><div className="task-columns"><ConnectionHealthPanel/><ConnectionSettings/></div></section>;}
