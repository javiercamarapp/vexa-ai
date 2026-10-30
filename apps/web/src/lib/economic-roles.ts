import {MONEY_SCREEN_ROLES} from '@vexa/platform/capabilities';
import {AccessError,resolveSession,type IdentityPort} from '@vexa/platform/session';
/** R2-03: la economía mezcla importes de dinero (ingreso bruto): solo roles de MONEY_SCREEN_ROLES (propietario y analista). Se comprueba con la membresía vigente ANTES de abrir la base; el resto recibe 403 role_insufficient. */
export async function exigirRolDeDinero(identity:IdentityPort,selectedTenant?:string):Promise<void>{
  const session=await resolveSession(identity,selectedTenant);
  if(!(MONEY_SCREEN_ROLES as readonly string[]).includes(session.active.role))throw new AccessError(403,'role_insufficient');
}
