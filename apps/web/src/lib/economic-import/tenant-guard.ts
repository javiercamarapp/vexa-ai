import type {createDatabase,DatabaseAction,DatabaseScope} from '@vexa/platform/db';
import {AccessError} from '@vexa/platform/session';
type Database=ReturnType<typeof createDatabase>;
/** A constraint on the authorized transaction; this header never selects an identity or tenant. */
export function constrainEconomicTenant(database:Database,expectedTenant:string|null):Database{
 if(expectedTenant===null)return database;
 if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(expectedTenant))throw new AccessError(400,'economic_import_tenant_invalid');
 return {transaction<T>(action:DatabaseAction,work:(scope:DatabaseScope)=>Promise<T>):Promise<T>{return database.transaction(action,async scope=>{if(scope.tenantId!==expectedTenant)throw new AccessError(409,'economic_import_tenant_changed');return work(scope);});}};
}
