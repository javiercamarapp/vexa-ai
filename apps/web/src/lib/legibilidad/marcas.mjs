// Marcadores que el paquete pone al ocultar datos de terceros ([nombre], [dirección], [dato personal oculto]): el paquete los inserta en español; aquí se rotulan en el idioma activo.
// Es presentación: la cita y su hash verificados no cambian. Sin traductor, el texto sale igual que lo devolvió el paquete.
import {MARCA_NOMBRE, MARCA_DIRECCION, MARCA_PII} from '../../../../../packages/workspace-service/enmascarar-terceros.mjs';
import {X} from './trad.mjs';

export function marcasEnIdioma(texto, t) {
  if (!t || typeof texto !== 'string') return texto;
  return texto.split(MARCA_PII).join(X(t, 'tr.mk.pii', MARCA_PII)).split(MARCA_NOMBRE).join(X(t, 'tr.mk.nombre', MARCA_NOMBRE)).split(MARCA_DIRECCION).join(X(t, 'tr.mk.direccion', MARCA_DIRECCION));
}
