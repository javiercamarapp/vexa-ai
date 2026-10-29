// Textos de los diagramas de red (T9). Los que existen en T11 salen de su árbol publicable; los rótulos cortos propios, de aquí.
import {LANDING} from '../../../content/sitio/landing';
import {proyectarArbol, publicar} from '../../../lib/sitio/marcadores.mjs';

export type Lang = 'es' | 'en';
export type IdDiagrama = 'problema-1' | 'problema-2' | 'problema-3' | 'problema-4' | 'seguridad' | 'integraciones' | 'procedencia';
export const IDS_DIAGRAMA: readonly IdDiagrama[] = ['problema-1', 'problema-2', 'problema-3', 'problema-4', 'seguridad', 'integraciones', 'procedencia'];

type Bi = {es: string; en: string};
const proj = <T,>(nodo: unknown, prefijo: string, lang: Lang): T => proyectarArbol(publicar(nodo, {prefijo}).arbol, lang) as T;

export const textosProblema = (lang: Lang) => proj<{columnas: {t: string; alt: string}[]}>(LANDING.problema, 'problema', lang);
export const textosSeguridad = (lang: Lang) => proj<{organizaciones: string[]; barrera: string; alt: string}>(LANDING.seguridad.diagrama, 'seguridad.diagrama', lang);
export const textosIntegraciones = (lang: Lang) => {
  const d = proj<{central: string; rutaEtiqueta: string; alt: string}>(LANDING.integraciones.diagrama, 'integraciones.diagrama', lang);
  const nombres = {
    hoy: [LANDING.integraciones.hoy[0].n, LANDING.integraciones.hoy[1].n].map((n) => n[lang]),
    ruta: LANDING.integraciones.chipsFila2.map((n) => n[lang]),
  };
  return {...d, ...nombres};
};
export const textosProcedencia = (lang: Lang) =>
  proj<{
    fuentes: {n: string; estado: string}[];
    nucleo: string;
    equipo: string;
    campos: string[];
  }>({fuentes: LANDING.procedencia.fuentes, nucleo: LANDING.procedencia.nucleo, equipo: LANDING.procedencia.equipo, campos: LANDING.procedencia.campos}, 'procedencia', lang);

const R: Record<string, Bi> = {
  soporte: {es: 'Soporte', en: 'Support'},
  pedidos: {es: 'Pedidos', en: 'Orders'},
  hojas: {es: 'Hojas', en: 'Sheets'},
  fuga: {es: 'Fuga', en: 'Leak'},
  llega: {es: 'Llega', en: 'Arrives'},
  plazo: {es: 'Plazo', en: 'Deadline'},
  tarde: {es: 'Tarde', en: 'Late'},
  sinClase: {es: 'Sin clase', en: 'No class'},
  cuarentena: {es: 'Cuarentena', en: 'Quarantine'},
  fuentes: {es: 'Fuentes', en: 'Sources'},
  altProcedencia: {
    es: 'Diagrama de línea: seis fuentes, tres de ellas con conexión continua y tres por exporte con conexión discontinua, entran al libro de la organización con fuente, fecha de lectura y huella de contenido, y de ahí a tu equipo. Un registro inválido sale a cuarentena.',
    en: 'Line diagram: six sources, three with a solid connection and three by export with a dashed connection, enter the organization ledger with source, read date and content fingerprint, and from there reach your team. An invalid record goes to quarantine.',
  },
  tituloProcedencia: {es: 'Procedencia de cada dato', en: 'Provenance of every record'},
  tituloSeguridad: {es: 'Aislamiento por organización', en: 'Isolation per organization'},
  tituloIntegraciones: {es: 'Integraciones', en: 'Integrations'},
};
export const rotulo = (k: keyof typeof R, lang: Lang): string => R[k][lang];
