import 'server-only';
import {forDownload,type DatabaseAction,type DatabaseScope} from '@vexa/platform/db';
import {registrar} from './registro';

/** forDownload + un evento `export` por descarga (R-3): quién, organización, clase de ruta y filas. Sin contenido. */
export function forDownloadAuditado<D extends {transaction:<T>(action:DatabaseAction,work:(scope:DatabaseScope)=>Promise<T>)=>Promise<T>}>(database:D,downloading:boolean):D{
  return forDownload(database,downloading,e=>{void registrar({kind:'export',tenantId:e.tenantId,actorId:e.userId,detail:e.rows===null?{}:{rows:e.rows}});});
}
