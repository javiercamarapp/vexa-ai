// Con varias raíces, una URL sin coincidencia caería en el 404 genérico de Next sin layout. Este catch-all la manda al not-found de la app, con su estilo y su idioma.
import {notFound} from 'next/navigation';

export default function RutaDesconocida() {
  notFound();
}
