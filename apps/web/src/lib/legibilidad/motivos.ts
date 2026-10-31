// Rótulos de motivo, submotivo, tipo de caso y retailer del Tracker: los paquetes (fuga-reembolsos, mapa-problemas) mandan el rótulo en español como siempre y esta capa lo
// traduce al idioma activo. El rótulo es a la vez el dato agrupado (clave de mapa), así que NO se cambia en el paquete: solo se traduce al pintar. Sin traductor, o con un rótulo que
// no está en el catálogo (un dato nuevo), sale tal cual. El catálogo es el diccionario: la clave tr.<tabla>.<slug> tiene como español el rótulo del paquete.
import {es} from '../i18n/es';

type Tr = (clave: never, vars?: Record<string, string | number>) => string;
type Tabla = 'tr.mot.' | 'tr.smot.' | 'tr.tcaso.' | 'tr.ret.';
const inversos = new Map<Tabla, Map<string, string>>();
function inverso(tabla: Tabla): Map<string, string> {
  let m = inversos.get(tabla);
  if (!m) {
    m = new Map();
    for (const [clave, texto] of Object.entries(es)) if (clave.startsWith(tabla) && !m.has(texto as string)) m.set(texto as string, clave);
    inversos.set(tabla, m);
  }
  return m;
}
function traducir(tabla: Tabla, rotulo: string, t?: Tr | null): string {
  if (!t || !rotulo) return rotulo;
  const clave = inverso(tabla).get(rotulo);
  return clave ? t(clave as never) : rotulo;
}
export const motivoEtiqueta = (rotulo: string, t?: Tr | null) => traducir('tr.mot.', rotulo, t);
export const submotivoEtiqueta = (rotulo: string, t?: Tr | null) => traducir('tr.smot.', rotulo, t);
export const tipoCasoEtiqueta = (rotulo: string, t?: Tr | null) => traducir('tr.tcaso.', rotulo, t);
export const retailerEtiqueta = (rotulo: string, t?: Tr | null) => traducir('tr.ret.', rotulo, t);
