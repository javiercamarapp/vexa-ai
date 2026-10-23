import {HistoryPanel} from '../../../components/history-panel';
import {AssociationPanel} from '../../../components/association-panel';
export const metadata={title:'Histórico e identidad'};
export default function HistoryPage(){return <div className="stack"><HistoryPanel/><AssociationPanel/></div>;}
