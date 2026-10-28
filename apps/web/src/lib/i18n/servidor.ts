import {cookies, headers} from 'next/headers';
import {COOKIE_IDIOMA, resolverIdioma, type Idioma} from './idioma';
/** Idioma de la petición en curso (servidor): cookie rovaq_lang, o Accept-Language si no hay cookie válida, o español. */
export async function idiomaActual(parametro?: unknown): Promise<Idioma> {
  const [jar, cab] = await Promise.all([cookies(), headers()]);
  return resolverIdioma({parametro, cookie: jar.get(COOKIE_IDIOMA)?.value, acceptLanguage: cab.get('accept-language')});
}
