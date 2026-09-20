import type {createDatabase,DatabaseScope} from '../platform/src/db';
export interface ImportUpload {id:string;import_id:string;tenant_id:string;user_id:string;object_path:string;size:number|string;content_type:string;expires_at:string;}
export function createImportHandler(ports:{database:ReturnType<typeof createDatabase>;confirmationSecret?:string;storage:{createUpload(scope:DatabaseScope,row:ImportUpload):Promise<{url:string}>;read(scope:Pick<DatabaseScope,'tenantId'|'userId'>,row:ImportUpload):Promise<Uint8Array>}}):(request:Request)=>Promise<Response>;
