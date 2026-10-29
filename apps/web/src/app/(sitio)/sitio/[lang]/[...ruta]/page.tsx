// Rutas desconocidas del sitio: host-routing las reescribe a /sitio/<lang>/__404, único parámetro pregenerado, que responde 404 real con la página no-encontrada del sitio.
// T7 sustituye este esqueleto por el despachador del registro.
import {notFound} from 'next/navigation';

// Un solo parámetro centinela: con dynamicParams=false (heredado del layout) cualquier otra ruta sin pregenerar caería al catch-all de la aplicación, por eso el enrutamiento nunca apunta a otra.
export function generateStaticParams() {
  return [{ruta: ['__404']}];
}

export default function RutaDesconocida() {
  notFound();
}
