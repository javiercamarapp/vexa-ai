// K3. Contrato de activos del sitio: public/s/manifest.json lo escriben las herramientas (cada una su sección) y este módulo lo lee en el build.
// Los componentes piden `url('pts/nucleo')`, `url('img/objeto-1', {ancho: 960})`, `url('fuentes/display')` o `url('nube.js')` y reciben la ruta con hash
// en el nombre (inmutable). Una clave que no está en el manifest rompe el build: no hay rutas escritas a mano.
// Esqueleto de T1: el manifest puede estar vacío o no existir todavía; T5 y T13 lo llenan.
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

export const SECCIONES_ACTIVOS = ['js', 'pts', 'img', 'fuentes', 'md'] as const;
export type SeccionActivos = (typeof SECCIONES_ACTIVOS)[number];

export type VarianteActivo = {url: string; ancho: number; alto?: number; bytes?: number};
export type EntradaActivo = {
  /** Ruta pública con hash de 8 en el nombre, por ejemplo /s/nube.ab12cd34.js. */
  url: string;
  bytes?: number;
  sha256?: string;
  /** Solo imágenes: dimensiones del original, para escribir width y height. */
  ancho?: number;
  alto?: number;
  /** Solo imágenes: tamaños alternativos, elegidos con la opción ancho. */
  variantes?: readonly VarianteActivo[];
};
export type ManifestActivos = {version?: number} & Partial<Record<SeccionActivos, Record<string, EntradaActivo>>>;
export type OpcionesUrl = {ancho?: number};

/** Separa 'pts/nucleo' en sección y nombre; una clave sin sección ('nube.js') es un script propio. */
export function partirClave(clave: string): {seccion: SeccionActivos; nombre: string} {
  const i = clave.indexOf('/');
  const seccion = (i < 0 ? 'js' : clave.slice(0, i)) as SeccionActivos;
  if (!SECCIONES_ACTIVOS.includes(seccion)) throw new Error(`ACTIVO_SECCION_DESCONOCIDA: ${clave}`);
  const nombre = i < 0 ? clave : clave.slice(i + 1);
  if (!nombre || nombre.includes('..')) throw new Error(`ACTIVO_CLAVE_INVALIDA: ${clave}`);
  return {seccion, nombre};
}

export function crearActivos(manifest: ManifestActivos) {
  const entrada = (clave: string): EntradaActivo => {
    const {seccion, nombre} = partirClave(clave);
    const e = manifest[seccion]?.[nombre];
    if (!e) throw new Error(`ACTIVO_NO_EN_MANIFEST: ${clave}`);
    return e;
  };
  return {
    /** Ruta pública del activo. Con {ancho} elige la variante de imagen de ese ancho exacto. */
    url(clave: string, opciones: OpcionesUrl = {}): string {
      const e = entrada(clave);
      if (opciones.ancho === undefined) return e.url;
      const v = e.variantes?.find((x) => x.ancho === opciones.ancho);
      if (!v) throw new Error(`ACTIVO_VARIANTE_NO_EXISTE: ${clave} ancho ${opciones.ancho}`);
      return v.url;
    },
    /** Dimensiones del original de una imagen, para width y height. */
    medidas(clave: string): {ancho: number; alto: number} {
      const e = entrada(clave);
      if (typeof e.ancho !== 'number' || typeof e.alto !== 'number') throw new Error(`ACTIVO_SIN_MEDIDAS: ${clave}`);
      return {ancho: e.ancho, alto: e.alto};
    },
    existe(clave: string): boolean {
      try { entrada(clave); return true; } catch { return false; }
    },
  };
}

/** Lee public/s/manifest.json; si todavía no existe devuelve un manifest vacío (esqueleto). */
export function leerManifest(raiz: string = process.cwd()): ManifestActivos {
  const archivo = join(raiz, 'public', 's', 'manifest.json');
  if (!existsSync(archivo)) return {version: 1};
  return JSON.parse(readFileSync(archivo, 'utf8')) as ManifestActivos;
}

const activos = crearActivos(leerManifest());
export const url = activos.url;
export const medidas = activos.medidas;
export const existe = activos.existe;
