// Marcadores entre corchetes, aprobaciones atadas al hash del texto y estado de publicación calculado (T11).
// Funciones puras sobre el árbol de contenido de content/sitio (landing.ts y paginas/**). Sin dependencias fuera de node:crypto y site.mjs.
//
// Reglas (SPEC-FINAL-LANDING 5.2 y 5.5):
// - [CORREO_DE_CONTACTO] y [CONTACT_EMAIL] se resuelven desde SITE.contacto.
// - [CORREO_DE_SEGURIDAD], [FECHA_DE_REVISION] y [RAZON_SOCIAL], con sus equivalentes en inglés, no se resuelven por defecto:
//   la hoja que los contiene no es publicable. Cualquier otro marcador MAYÚSCULAS entre corchetes tampoco.
// - Una hoja MATIZ con `req` se publica solo si aprobaciones.json trae, para cada revisor, una aprobación con el SHA-256 del texto actual.
//   Si el texto cambia, la aprobación deja de valer y la hoja vuelve a pendiente.
// - Una hoja MATIZ con `verifica` se publica solo si esa verificación está cumplida en aprobaciones.json.
// - Una hoja MATIZ con `condicion.acompana` solo se publica si todas esas hojas se publican.
// - Una hoja no publicable se sustituye por su `alterno` cuando éste es publicable; si no, se omite. En una lista, se omite el elemento entero.

import { createHash } from 'node:crypto';
import { SITE } from '../site.mjs';

const RE_MARCADOR = /\[[A-Z][A-Z0-9_]*\]/g;

export const MARCADORES = Object.freeze({
  contacto: ['[CORREO_DE_CONTACTO]', '[CONTACT_EMAIL]'],
  seguridad: ['[CORREO_DE_SEGURIDAD]', '[SECURITY_EMAIL]'],
  fechaRevision: ['[FECHA_DE_REVISION]', '[REVIEW_DATE]'],
  razonSocial: ['[RAZON_SOCIAL]', '[LEGAL_NAME]'],
});

/** Contexto de resolución del build. Solo el contacto está resuelto: lo demás se llena cuando exista y se haya decidido. */
export function contextoPorDefecto(sitio = SITE) {
  return { contacto: sitio.contacto, seguridad: null, fechaRevision: null, razonSocial: null };
}

/** Marcadores entre corchetes presentes en un texto, sin repetir. */
export function marcadoresEn(texto) {
  return [...new Set(String(texto).match(RE_MARCADOR) ?? [])];
}

/** Sustituye los marcadores que el contexto resuelve. Devuelve el texto y los que no pudo resolver. */
export function resolverMarcadores(texto, ctx = contextoPorDefecto()) {
  const sinResolver = [];
  const salida = String(texto).replace(RE_MARCADOR, (marca) => {
    for (const [clave, marcas] of Object.entries(MARCADORES)) {
      if (marcas.includes(marca)) {
        const valor = ctx?.[clave];
        if (typeof valor === 'string' && valor.trim() !== '') return valor.trim();
      }
    }
    if (!sinResolver.includes(marca)) sinResolver.push(marca);
    return marca;
  });
  return { texto: salida, sinResolver };
}

// ---------------------------------------------------------------- hojas y rutas

export const esHoja = (n) => typeof n === 'object' && n !== null && !Array.isArray(n) && typeof n.es === 'string' && typeof n.en === 'string';

/** Recorre el árbol y llama a visita(ruta, hoja) por cada hoja bilingüe. Rutas como hero.titulo o faq.items[8].q. */
export function recorrer(nodo, visita, ruta = '') {
  if (typeof nodo === 'string') return;
  if (esHoja(nodo)) { visita(ruta, nodo); return; }
  if (Array.isArray(nodo)) { nodo.forEach((x, i) => recorrer(x, visita, `${ruta}[${i}]`)); return; }
  if (nodo && typeof nodo === 'object') {
    for (const [k, v] of Object.entries(nodo)) recorrer(v, visita, ruta ? `${ruta}.${k}` : k);
  }
}

/** Lista plana de hojas { ruta, hoja }. */
export function hojas(nodo, prefijo = '') {
  const lista = [];
  recorrer(nodo, (ruta, hoja) => lista.push({ ruta: prefijo ? (ruta ? `${prefijo}.${ruta}` : prefijo) : ruta, hoja }));
  return lista;
}

/** Busca una hoja por ruta dentro del árbol. */
export function hojaEn(nodo, ruta) {
  const pasos = [...String(ruta).matchAll(/([^.[\]]+)|\[(\d+)\]/g)].map((m) => (m[2] !== undefined ? Number(m[2]) : m[1]));
  let actual = nodo;
  for (const p of pasos) {
    if (actual == null) return undefined;
    actual = actual[p];
  }
  return actual;
}

// ---------------------------------------------------------------- hash y aprobaciones

/** SHA-256 del texto de una hoja, en los dos idiomas. Cambiar cualquiera de los dos cambia el hash. */
export function hashTexto(hoja) {
  return createHash('sha256').update(JSON.stringify([hoja.es, hoja.en])).digest('hex');
}

/** Aprobaciones vacías con las 13 verificaciones sin cumplir. */
export function aprobacionesVacias() {
  const condiciones = {};
  for (let n = 1; n <= 13; n += 1) condiciones[String(n)] = { cumplida: false };
  return { version: 1, condiciones, campos: {} };
}

/** Devuelve unas aprobaciones nuevas con la aprobación de `revisor` sobre la hoja, atada a su hash actual. No muta la entrada. */
export function aprobar(aprobaciones, ruta, revisor, hoja, { fecha = new Date().toISOString().slice(0, 10), nota = '' } = {}) {
  const base = aprobaciones ?? aprobacionesVacias();
  const campos = { ...(base.campos ?? {}) };
  campos[ruta] = { ...(campos[ruta] ?? {}), [revisor]: { hash: hashTexto(hoja), fecha, nota } };
  return { ...base, campos };
}

/** Marca una verificación 1 a 13 como cumplida o no. No muta la entrada. */
export function marcarCondicion(aprobaciones, n, cumplida, { fecha = new Date().toISOString().slice(0, 10), nota = '' } = {}) {
  const base = aprobaciones ?? aprobacionesVacias();
  return { ...base, condiciones: { ...(base.condiciones ?? {}), [String(n)]: { cumplida: Boolean(cumplida), fecha, nota } } };
}

// ---------------------------------------------------------------- estado de publicación

/** Estado de una hoja por sí sola, sin mirar sus acompañantes. */
export function estadoHoja(ruta, hoja, { aprobaciones = aprobacionesVacias(), ctx = contextoPorDefecto() } = {}) {
  const motivos = [];
  const sin = new Set([...resolverMarcadores(hoja.es, ctx).sinResolver, ...resolverMarcadores(hoja.en, ctx).sinResolver]);
  for (const marca of sin) motivos.push(`marcador sin resolver ${marca}`);
  if (hoja.nivel === 'MATIZ') {
    if (!hoja.condicion || typeof hoja.condicion.texto !== 'string' || hoja.condicion.texto.trim() === '') motivos.push('MATIZ sin condición escrita');
    const actual = hashTexto(hoja);
    for (const revisor of hoja.req ?? []) {
      const registro = aprobaciones?.campos?.[ruta]?.[revisor];
      if (!registro) motivos.push(`falta la aprobación de ${revisor}`);
      else if (registro.hash !== actual) motivos.push(`la aprobación de ${revisor} ya no vale: el texto cambió`);
    }
    if (hoja.verifica != null && aprobaciones?.condiciones?.[String(hoja.verifica)]?.cumplida !== true) {
      motivos.push(`verificación ${hoja.verifica} sin cumplir`);
    }
  }
  return { ruta, publicable: motivos.length === 0, motivos };
}

/**
 * Estado de todas las hojas de un árbol. Aplica también `acompana`: una hoja MATIZ cuyo acompañante no se publica, no se publica.
 * `prefijo` se antepone a las rutas (por ejemplo paginas.seguridad). Las rutas de `acompana` y `alterno` son relativas al árbol.
 */
export function estadoPublicacion(arbol, { aprobaciones = aprobacionesVacias(), ctx = contextoPorDefecto(), prefijo = '' } = {}) {
  const lista = hojas(arbol).map(({ ruta, hoja }) => {
    const e = estadoHoja(prefijo ? `${prefijo}.${ruta}` : ruta, hoja, { aprobaciones, ctx });
    return { local: ruta, hoja, publicable: e.publicable, motivos: e.motivos };
  });
  const porRuta = new Map(lista.map((x) => [x.local, x]));
  for (const x of lista) {
    for (const otra of x.hoja.condicion?.acompana ?? []) {
      const y = porRuta.get(otra);
      if (!y) x.motivos.push(`acompañante inexistente ${otra}`);
      else if (!y.publicable && !(y.hoja.alterno && porRuta.get(y.hoja.alterno)?.publicable)) x.motivos.push(`su acompañante ${otra} no se publica`);
    }
    x.publicable = x.motivos.length === 0;
  }
  return lista.map(({ local, hoja, publicable, motivos }) => ({
    ruta: prefijo ? `${prefijo}.${local}` : local,
    rutaLocal: local,
    nivel: hoja.nivel ?? 'PUBLICO',
    req: hoja.req ?? [],
    verifica: hoja.verifica ?? null,
    alterno: hoja.alterno ?? null,
    condicion: hoja.condicion ?? null,
    hash: hashTexto(hoja),
    publicable,
    motivos,
    es: hoja.es,
    en: hoja.en,
  }));
}

/**
 * Árbol publicable: marcadores resueltos, alternos aplicados y lo no publicable omitido.
 * Devuelve { arbol, omitidas, sustituidas, resolver } con el árbol aún bilingüe. Las hojas alternas consumidas no quedan bajo su propia clave.
 */
export function publicar(arbol, { aprobaciones = aprobacionesVacias(), ctx = contextoPorDefecto(), prefijo = '' } = {}) {
  const estados = estadoPublicacion(arbol, { aprobaciones, ctx, prefijo });
  const porLocal = new Map(estados.map((e) => [e.rutaLocal, e]));
  const omitidas = [];
  const sustituidas = [];
  const consumidas = new Set(estados.filter((e) => e.alterno).map((e) => e.alterno));

  const limpiar = (hoja) => {
    const es = resolverMarcadores(hoja.es, ctx).texto;
    const en = resolverMarcadores(hoja.en, ctx).texto;
    const salida = { es, en };
    if (hoja.nivel) salida.nivel = hoja.nivel;
    if (hoja.condicion) salida.condicion = hoja.condicion;
    return salida;
  };

  const ir = (nodo, ruta) => {
    if (typeof nodo === 'string') return { valor: nodo, quitar: false };
    if (esHoja(nodo)) {
      const e = porLocal.get(ruta);
      if (e.publicable) return { valor: limpiar(nodo), quitar: false };
      const alt = nodo.alterno ? porLocal.get(nodo.alterno) : null;
      if (alt?.publicable) {
        sustituidas.push({ ruta: e.ruta, por: alt.ruta, motivos: e.motivos });
        return { valor: limpiar(hojaEn(arbol, nodo.alterno)), quitar: false };
      }
      omitidas.push({ ruta: e.ruta, motivos: e.motivos });
      return { valor: undefined, quitar: true };
    }
    if (Array.isArray(nodo)) {
      const salida = [];
      nodo.forEach((x, i) => {
        const r = ir(x, `${ruta}[${i}]`);
        if (typeof x === 'string') { salida.push(r.valor); return; }
        if (esHoja(x) ? r.quitar : r.perdio) return;
        salida.push(r.valor);
      });
      return { valor: salida, quitar: false };
    }
    const salida = {};
    let perdio = false;
    for (const [k, v] of Object.entries(nodo)) {
      const sub = ruta ? `${ruta}.${k}` : k;
      if (consumidas.has(sub)) continue;
      const r = ir(v, sub);
      if (Array.isArray(v)) { salida[k] = r.valor; continue; }
      if (esHoja(v)) { if (r.quitar) perdio = true; else salida[k] = r.valor; continue; }
      if (v && typeof v === 'object') { if (r.perdio) perdio = true; salida[k] = r.valor; continue; }
      salida[k] = r.valor;
    }
    return { valor: salida, quitar: false, perdio };
  };

  const r = ir(arbol, '');
  return { arbol: r.valor, omitidas, sustituidas, estados };
}

/** Proyecta un árbol bilingüe (por ejemplo el de publicar) a un idioma. */
export function proyectarArbol(nodo, lang) {
  if (typeof nodo === 'string') return nodo;
  if (esHoja(nodo)) return nodo[lang];
  if (Array.isArray(nodo)) return nodo.map((x) => proyectarArbol(x, lang));
  return Object.fromEntries(Object.entries(nodo).map(([k, v]) => [k, proyectarArbol(v, lang)]));
}

/** Enlace mailto del botón Solicitar acceso. Asunto y cuerpo codificados; null si no hay un contacto resuelto. */
export function construirMailto({ contacto, asunto, cuerpo }) {
  if (typeof contacto !== 'string' || contacto.trim() === '') return null;
  const partes = [];
  if (asunto) partes.push(`subject=${encodeURIComponent(asunto)}`);
  if (cuerpo) partes.push(`body=${encodeURIComponent(cuerpo)}`);
  return `mailto:${contacto.trim()}${partes.length ? `?${partes.join('&')}` : ''}`;
}

/** Estado de publicación de una página interna: pendiente si lo declara o si alguna hoja requerida no se publica. */
export function estadoPagina(pagina, { aprobaciones = aprobacionesVacias(), ctx = contextoPorDefecto() } = {}) {
  const motivos = [];
  if (pagina.estado === 'pendiente-de-revision') motivos.push(pagina.pendiente ?? 'pendiente de revisión');
  const hojasDePagina = estadoPublicacion(pagina, { aprobaciones, ctx, prefijo: `paginas.${pagina.id}` });
  const huecos = hojasDePagina.filter((h) => !h.publicable);
  for (const h of huecos) motivos.push(`${h.ruta}: ${h.motivos.join(', ')}`);
  return { id: pagina.id, publicable: motivos.length === 0, motivos, hojas: hojasDePagina };
}
