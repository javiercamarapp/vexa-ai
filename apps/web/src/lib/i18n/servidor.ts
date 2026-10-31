import {cookies, headers} from 'next/headers';
import {COOKIE_IDIOMA, resolverIdioma, type Idioma} from './idioma';
/** Decisión pura (probada sin Next): ?lang= válido, cookie rovaq_lang válida, Accept-Language del navegador (es* → es, en* → en, otro → en), inglés. */
export function idiomaDeFuentes(jar: {get(nombre: string): {value: string} | undefined}, cabeceras: {get(nombre: string): string | null}, parametro?: unknown): Idioma {
  return resolverIdioma({parametro, cookie: jar.get(COOKIE_IDIOMA)?.value, acceptLanguage: cabeceras.get('accept-language')});
}
/** Idioma de la petición en curso (servidor): ?lang= si se pasa, cookie rovaq_lang válida (manda sobre el navegador), Accept-Language, o inglés.
 *  Ya era dinámico por leer la cookie; leer también la cabecera no vuelve dinámico nada que fuera estático (el sitio público no pasa por aquí). */
export async function idiomaActual(parametro?: unknown): Promise<Idioma> {
  const [jar, cabeceras] = await Promise.all([cookies(), headers()]);
  return idiomaDeFuentes(jar, cabeceras, parametro);
}
