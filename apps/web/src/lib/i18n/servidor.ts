import {cookies} from 'next/headers';
import {COOKIE_IDIOMA, resolverIdioma, type Idioma} from './idioma';
/** Idioma de la petición en curso (servidor): ?lang= si se pasa, cookie rovaq_lang válida, o inglés. El Accept-Language del navegador no interviene. */
export async function idiomaActual(parametro?: unknown): Promise<Idioma> {
  const jar = await cookies();
  return resolverIdioma({parametro, cookie: jar.get(COOKIE_IDIOMA)?.value});
}
