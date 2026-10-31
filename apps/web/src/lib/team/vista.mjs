// Presentación del equipo para el cliente: sin cuentas técnicas del sistema, roles en español (el valor interno no cambia) y sin ofrecer «Revocar» donde el servicio lo rechazaría.
export const ROLES=Object.freeze(['owner','analyst','operator','viewer']);
export const ROL_ES=Object.freeze({owner:'Administrador del espacio',analyst:'Analista',operator:'Operador',viewer:'Lectura'});
export const ESTADO_ES=Object.freeze({active:'Activo',revoked:'Revocado',pending:'Pendiente',expired:'Vencida',cancelled:'Cancelada',accepted:'Aceptada'});
export const rolEs=(rol)=>ROL_ES[rol]??'Rol desconocido';
export const estadoEs=(estado)=>ESTADO_ES[estado]??estado;
/** Cuenta de servicio del sistema (dominio .invalid o patrón worker-): no es una persona del cliente. */
export const esCuentaTecnica=(email)=>/@[^@\s]*\.invalid$/i.test(String(email??''))||/^worker-/i.test(String(email??''));
export const visibles=(items)=>items.filter(i=>!esCuentaTecnica(i.email));
/**
 * ¿Se ofrece «Revocar» sobre este miembro? No sobre uno mismo ni sobre el último propietario activo (conocido: sin más páginas).
 * Es solo la guarda de la interfaz; el servicio sigue rechazando con team_last_owner.
 */
export function puedeRevocar(item,{viewerId=null,items=[],hayMas=false}={}){
 if(item.status!=='active')return false;
 if(viewerId&&item.id===viewerId)return false;
 if(item.role==='owner'){const activos=items.filter(i=>i.role==='owner'&&i.status==='active').length;if(activos<2&&!hayMas)return false;}
 return true;
}
