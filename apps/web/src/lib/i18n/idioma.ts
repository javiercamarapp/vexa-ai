// Idioma de la interfaz (solo la interfaz: los datos del cliente y el texto de IA que llega del servidor no se traducen).
// Núcleo sin dependencias de Next: lo usan el servidor, los componentes cliente y las pruebas.
export const IDIOMAS = ['es', 'en'] as const;
export type Idioma = (typeof IDIOMAS)[number];
/** Cookie de preferencia: solo «es» o «en», sin datos personales; la lee el servidor en cada petición. */
export const COOKIE_IDIOMA = 'rovaq_lang';
export const IDIOMA_POR_OMISION: Idioma = 'en';
/** Locale de Intl para cifras, fechas y moneda de cada idioma. */
export const LOCALE_INTL: Record<Idioma, string> = {es: 'es-MX', en: 'en-US'};
/** Valida un valor cualquiera (cookie, ?lang=): solo «es» o «en» exactos; todo lo demás es null. */
export function idiomaValido(valor: unknown): Idioma | null {
  return valor === 'es' || valor === 'en' ? valor : null;
}
/** Primer idioma soportado de un Accept-Language («en-US,en;q=0.9,es;q=0.8» → en), respetando el orden de q. Sin coincidencia: null. */
export function idiomaDeAcceptLanguage(cabecera: string | null | undefined): Idioma | null {
  if (!cabecera) return null;
  const candidatos = cabecera.slice(0, 512).split(',').map((parte, orden) => {
    const [etiqueta, ...params] = parte.trim().split(';');
    const q = params.map((p) => /^\s*q\s*=\s*([\d.]+)\s*$/.exec(p)?.[1]).find((v) => v !== undefined);
    return {base: etiqueta.trim().toLowerCase().split('-')[0], q: q === undefined ? 1 : Number(q), orden};
  }).filter((c) => c.q > 0 && Number.isFinite(c.q));
  candidatos.sort((a, b) => b.q - a.q || a.orden - b.orden);
  for (const c of candidatos) { const v = idiomaValido(c.base); if (v) return v; }
  return null;
}
/** Orden de decisión: ?lang= válido, cookie rovaq_lang válida, preferencia guardada de la persona (user_preferences; solo la conoce quien ya leyó la base, p. ej. el middleware),
 *  idioma del navegador (Accept-Language: es* → es, en* → en, cualquier otro → en) y, sin nada de eso, inglés.
 *  La cookie, cuando existe y es válida, SIEMPRE manda sobre lo demás (la persona ya eligió en el selector). Una cookie inválida cuenta como ausente. */
export function resolverIdioma({parametro, cookie, preferencia, acceptLanguage}: {parametro?: unknown; cookie?: unknown; preferencia?: unknown; acceptLanguage?: string | null}): Idioma {
  return idiomaValido(parametro) ?? idiomaValido(cookie) ?? idiomaValido(preferencia) ?? idiomaDeAcceptLanguage(acceptLanguage) ?? IDIOMA_POR_OMISION;
}
/** Marca (cookie de corta vida) que dice «ya se consultó la preferencia y no hay ninguna»: evita repetir la lectura a la base en cada navegación. */
export const COOKIE_SIN_PREFERENCIA = 'rovaq_lang_sin_pref';
/** ¿Vale la pena leer la preferencia guardada para sembrar la cookie? Solo con una persona autenticada, sin ?lang= explícito, sin cookie válida y sin la marca de «no hay preferencia». */
export function debeSembrarIdioma({parametro, cookie, marca}: {parametro?: unknown; cookie?: unknown; marca?: unknown}): boolean {
  return idiomaValido(parametro) === null && idiomaValido(cookie) === null && !marca;
}
/** Idioma de una petición (middleware, rutas, páginas): cookie rovaq_lang y cabecera Accept-Language, sin tocar nada más. `parametro` es el ?lang= si la ruta lo admite. */
export function idiomaDeSolicitud(solicitud: {cookies: {get(nombre: string): {value: string} | undefined}; headers?: {get(nombre: string): string | null} | null}, parametro?: unknown): Idioma {
  return resolverIdioma({parametro, cookie: solicitud.cookies.get(COOKIE_IDIOMA)?.value, acceptLanguage: solicitud.headers?.get('accept-language') ?? null});
}
/** Guarda la preferencia en el navegador (cookie rovaq_lang) y alinea <html lang>. Solo cliente. */
export function guardarIdiomaEnNavegador(idioma: Idioma): void {
  document.cookie = cookieIdioma(idioma, window.location.protocol === 'https:');
  document.documentElement.lang = idioma;
}
/** Texto de la cookie para document.cookie (cliente). */
export function cookieIdioma(idioma: Idioma, seguro = false): string {
  return `${COOKIE_IDIOMA}=${idioma}; Path=/; Max-Age=31536000; SameSite=Lax${seguro ? '; Secure' : ''}`;
}
