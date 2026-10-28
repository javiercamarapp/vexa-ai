// ¿La ruta actual es la pantalla `href` del recorrido? Para el menú del cliente usa el mismo criterio que el encabezado (itemActivo: alias y coincidencia más específica);
// para la consola de plataforma, la ruta exacta o una subruta.
import { itemActivo } from '../workspace/menu.mjs';
export function enPantalla(ruta, href) {
  if (typeof ruta !== 'string' || typeof href !== 'string') return false;
  if (href === '/platform') return ruta === '/platform';
  if (href.startsWith('/platform/')) return ruta === href || ruta.startsWith(href + '/');
  return itemActivo(ruta)?.item.href === href;
}
