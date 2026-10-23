// Preferencias de avisos para el cliente: solo los eventos que sí se envían y el estado de cada canal en lenguaje claro.
/** Los eventos aún no conectados no se ofrecen: una casilla que no hace nada solo confunde. */
export const eventosVisibles=(catalogo)=>catalogo.filter(e=>e.connected);
const CANALES=Object.freeze({
 inapp:{disponible:'Los avisos llegan a tu centro de notificaciones.',pendiente:'El centro de notificaciones aún no está habilitado para tu organización.'},
 email:{disponible:'Los avisos se envían a tu correo.',pendiente:'El envío por correo aún no está configurado. Puedes guardar tu preferencia para cuando lo esté.'},
 push:{disponible:'Los avisos llegan a este dispositivo.',pendiente:'Las notificaciones en el dispositivo requieren activarlas con tu permiso. Puedes guardar tu preferencia para cuando estén listas.'}});
export function textoCanal(canal){const t=CANALES[canal.id];if(!t)return canal.deliveryAvailable?'Canal disponible.':'Canal aún no disponible.';return canal.deliveryAvailable?t.disponible:t.pendiente;}
