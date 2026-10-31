// Idioma del turno del agente. Solo 'es' (por omisión del paquete: lo fijan las pruebas existentes) o 'en'.
// La web siempre lo pasa explícito (cookie rovaq_lang); nunca se infiere del texto de la pregunta.
export const IDIOMAS_AGENTE = Object.freeze(['es', 'en']);
export const idiomaDe = (valor) => {
  const v = valor && typeof valor === 'object' ? valor.idioma : valor;
  return v === 'en' ? 'en' : 'es';
};
/** Par bilingüe: `par(idioma)(es, en)`. */
export const par = (idioma) => (es, en) => (idiomaDe(idioma) === 'en' ? en : es);
export const localeAgente = (idioma) => (idiomaDe(idioma) === 'en' ? 'en-US' : 'es-MX');
