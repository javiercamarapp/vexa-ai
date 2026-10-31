// Funciones puras de los artículos del blog (T24): texto plano, palabras, tiempo de lectura, tabla de contenido y fecha legible.
// Sin Next y sin lectura de archivos: las usan el renderizador, las fichas de SEO, el generador de espejos Markdown y las pruebas.

/** Palabras por minuto para el tiempo de lectura. El resultado siempre se redondea hacia arriba y nunca baja de 1. */
export const PALABRAS_POR_MINUTO = 200;

const hoja = (h, lang) => (typeof h === 'string' ? h : (h?.[lang] ?? ''));

/**
 * Enlace interno dentro de un texto de artículo: {{id|texto visible}}, con el id del registro K2 (fuga-de-reembolsos, analista, a2).
 * Se enlaza solo si la página se publica; si no, queda el texto visible. Sin paréntesis ni corchetes, por la regla editorial (en lo publicable no sobrevive ningún corchete).
 */
export const RE_ENLACE = /\{\{([a-z0-9-]+)\|([^{}|]+)\}\}/g;

/** Partes de un texto con enlaces internos: [{ texto }] y [{ id, texto }] en orden. */
export function partirEnlaces(texto) {
  const partes = [];
  let ultimo = 0;
  for (const m of String(texto).matchAll(RE_ENLACE)) {
    if (m.index > ultimo) partes.push({ texto: texto.slice(ultimo, m.index) });
    partes.push({ id: m[1], texto: m[2] });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) partes.push({ texto: texto.slice(ultimo) });
  return partes;
}

/** Ids de página citados con [[id|texto]] en un texto. */
export const idsEnlazados = (texto) => [...String(texto).matchAll(RE_ENLACE)].map((m) => m[1]);

/** El texto sin la sintaxis de enlace: solo la parte visible. */
export const sinEnlaces = (texto) => String(texto).replace(RE_ENLACE, '$2');

/** Textos de un bloque de artículo, en un idioma, como lista de cadenas. */
export function textosDeBloque(bloque, lang) {
  if (!bloque) return [];
  if (Array.isArray(bloque.items)) return bloque.items.map((x) => hoja(x, lang));
  return [hoja(bloque.texto, lang)];
}

/** Texto plano del cuerpo de un artículo (todos los bloques), separado por saltos de línea. */
export function textoPlano(bloques, lang) {
  return (bloques ?? []).flatMap((b) => textosDeBloque(b, lang)).map(sinEnlaces).join('\n');
}

/** Cantidad de palabras de un texto (secuencias separadas por espacio; sin contar signos sueltos). */
export function contarPalabras(texto) {
  return String(texto).split(/\s+/u).filter((x) => /[\p{L}\p{N}]/u.test(x)).length;
}

export const palabrasDeArticulo = (bloques, lang) => contarPalabras(textoPlano(bloques, lang));

/** Tiempo de lectura en minutos enteros, derivado del cuerpo. */
export function minutosDeLectura(bloques, lang) {
  return Math.max(1, Math.ceil(palabrasDeArticulo(bloques, lang) / PALABRAS_POR_MINUTO));
}

/** Identificador de ancla: minúsculas, sin acentos, guiones; nunca vacío. */
export function slug(texto) {
  const s = String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '');
  return s || 'seccion';
}

/**
 * Secciones h2 y h3 del cuerpo con su ancla única: [{ id, texto, nivel, indice }] donde indice es la posición del bloque.
 * Los anclas repetidas reciben sufijo -2, -3. La nota «Lo que no afirmamos» tiene su propia ancla fija (ANCLA_NO_AFIRMAMOS).
 */
export function seccionesDe(bloques, lang) {
  const usados = new Map();
  const salida = [];
  (bloques ?? []).forEach((b, indice) => {
    if (b.tipo !== 'h2' && b.tipo !== 'h3') return;
    const texto = hoja(b.texto, lang);
    const base = slug(texto);
    const n = (usados.get(base) ?? 0) + 1;
    usados.set(base, n);
    salida.push({ id: n === 1 ? base : `${base}-${n}`, texto, nivel: b.tipo === 'h2' ? 2 : 3, indice });
  });
  return salida;
}

export const ANCLA_NO_AFIRMAMOS = Object.freeze({ es: 'lo-que-no-afirmamos', en: 'what-we-do-not-claim' });
export const ROTULO_NO_AFIRMAMOS = Object.freeze({ es: 'Lo que no afirmamos', en: 'What we do not claim' });

/** Fecha legible de una fecha ISO AAAA-MM-DD: «3 de noviembre de 2026» / «November 3, 2026». Siempre en UTC: no depende de la zona del build. */
export function fechaLegible(iso, lang) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Fecha inválida: ${iso}`);
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(d);
}

/** Etiqueta de un artículo en un idioma: la ficha puede traerla como cadena (heredado) o como hoja bilingüe. */
export function etiquetaDe(ficha, lang) {
  const e = ficha?.etiqueta;
  if (!e) return null;
  return typeof e === 'string' ? e : (e[lang] ?? null);
}

/** Texto «N min de lectura» / «N min read». */
export const rotuloLectura = (minutos, lang) => (lang === 'es' ? `${minutos} min de lectura` : `${minutos} min read`);

/** ¿Es una fecha AAAA-MM-DD real? */
export function esFechaIso(x) {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  const d = new Date(`${x}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === x;
}
