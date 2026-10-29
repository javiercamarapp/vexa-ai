// Rutas desconocidas del sitio: ninguna está pregenerada y dynamicParams es falso, así que responden 404 real con la página no-encontrada del sitio.
// T7 sustituye este esqueleto por el despachador del registro.
import {notFound} from 'next/navigation';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return [] as {ruta: string[]}[];
}

export default function RutaDesconocida() {
  notFound();
}
