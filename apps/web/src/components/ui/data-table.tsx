import type {ReactNode} from 'react';
import {EmptyState} from './empty-state';
import {ErrorState} from './error-state';
import {Loading} from './loading';
import {useT} from '../i18n/proveedor';
export type Column<T>={key:string;header:ReactNode;render:(row:T)=>ReactNode;/** num = alineada a la derecha con cifras tabulares */align?:'start'|'num';width?:string};
/** Tabla: cabecera pegajosa, densidad cómoda (40 px), números tabulares y estados cargando/error/vacío integrados. */
export function DataTable<T>({columns,rows,rowKey,caption,state='ready',onRetry,empty,errorBody,maxHeight='min(62dvh,640px)'}:{columns:Column<T>[];rows:T[];rowKey:(r:T)=>string;caption:string;state?:'ready'|'loading'|'error';onRetry?:()=>void;empty?:ReactNode;errorBody?:ReactNode;maxHeight?:string}){
 const t=useT();
 if(state==='loading')return <div className="ui-table-state"><Loading compact/></div>;
 if(state==='error')return <div className="ui-table-state"><ErrorState body={errorBody} onRetry={onRetry} compact/></div>;
 if(!rows.length)return <>{empty??<EmptyState compact art="inbox" title={t('tr.ui.sinFilas')} body={t('tr.ui.sinRegistros')}/>}</>;
 return <div className="ui-table-wrap" style={{maxHeight}} tabIndex={0} role="region" aria-label={caption}>
  <table className="ui-table"><caption className="sr-only">{caption}</caption>
   <thead><tr>{columns.map(c=><th key={c.key} scope="col" data-align={c.align} style={c.width?{width:c.width}:undefined}>{c.header}</th>)}</tr></thead>
   <tbody>{rows.map(r=><tr key={rowKey(r)}>{columns.map(c=><td key={c.key} data-align={c.align}>{c.render(r)}</td>)}</tr>)}</tbody>
  </table></div>;
}
