import {HistoryPanel} from '../../../components/history-panel';
import {IdentidadHistorial} from '../../../components/datos/cobertura-conexiones';
import {AssociationPanel} from '../../../components/association-panel';
import {metaTitulo} from '../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.history');
export default function HistoryPage(){return <div className="stack"><HistoryPanel destacado={<IdentidadHistorial/>}/><AssociationPanel/></div>;}
