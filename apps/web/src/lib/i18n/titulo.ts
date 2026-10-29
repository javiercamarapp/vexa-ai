import type {Metadata} from 'next';
import {traducir, type Clave} from './index';
import {idiomaActual} from './servidor';
/** Metadatos de una pantalla con su título en el idioma activo (cookie rovaq_lang, o inglés). `extra` agrega robots, manifest, etc. Se exporta como `generateMetadata`. */
export async function metaTitulo(clave: Clave, extra: Metadata = {}): Promise<Metadata> {
  return {title: traducir(await idiomaActual(), clave), ...extra};
}
