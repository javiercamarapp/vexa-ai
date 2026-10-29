// Idioma de los correos, avisos y página de baja. Núcleo sin dependencias: lo comparten email-system, las plantillas,
// el push y la baja. Solo «es» o «en» exactos; cualquier otro valor (o ausencia) cae a «es», que es el comportamiento
// histórico byte a byte. Los correos de cron no tienen solicitud ni preferencia por persona: usan el default «es».
export const IDIOMAS = Object.freeze(['es', 'en']);
export const IDIOMA_POR_OMISION = 'es';
export const idiomaDe = valor => (valor === 'en' ? 'en' : 'es');
/** Locale de Intl para cifras y fechas (el mismo mapa que apps/web/src/lib/i18n/idioma.ts). */
export const LOCALE = Object.freeze({es: 'es-MX', en: 'en-US'});
/** Etiqueta BCP 47 del atributo lang y de Content-Language. */
export const langDe = idioma => LOCALE[idiomaDe(idioma)];
/** Selecciona la variante de un par {es, en}. */
export const porIdioma = (idioma, es, en) => (idiomaDe(idioma) === 'en' ? en : es);

/** Título y cuerpo del aviso push por idioma (el español es el texto histórico, byte a byte). */
export const PUSH_TEXTOS = Object.freeze({
  es: Object.freeze({title: 'Rovaq AI', body: 'Tienes avisos disponibles en Rovaq AI.'}),
  en: Object.freeze({title: 'Rovaq AI', body: 'You have notifications waiting in Rovaq AI.'}),
});
export const textoPush = idioma => PUSH_TEXTOS[idiomaDe(idioma)];
