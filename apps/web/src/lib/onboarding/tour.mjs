// Recorrido guiado «página por página» (F2b): se CONSTRUYE desde el catálogo y el menú real del rol, no es una lista aparte.
//  - Pantallas: las que el rol ve en su menú (menuVisible) en el orden del menú; la pista de plataforma, las del catálogo; «soporte» no tiene recorrido.
//  - Por pantalla: un paso «ir» (te dice qué apretar en el menú; avanza solo al hacer clic), «que» (qué es; usa el texto del catálogo del rol si lo hay),
//    «clave» (el elemento clave) y, si el rol tiene la capacidad, «accion» (la acción principal). Al final, un paso de cierre.
import { pasosDe, ROL_DE_PISTA, rolTieneCapacidad } from './catalogo.mjs';
import { PANTALLAS, QUE, slugDe } from './pantallas.mjs';
import { OBJETIVOS } from './recorrido.mjs';
import { menuVisible } from '../workspace/menu.mjs';

/** Rutas (en orden) que recorre una pista. */
export function pantallasDe(pista) {
  if (pista === 'plataforma') return pasosDe('plataforma', 'tour').map((p) => p.href).filter(Boolean);
  const rol = ROL_DE_PISTA[pista];
  if (!rol) return [];
  return menuVisible({ role: rol }).flatMap((e) => (e.tipo === 'grupo' ? e.items : [e])).map((i) => i.href).filter((h) => Object.hasOwn(PANTALLAS, h));
}

/** Modos del recorrido: «completo» (todas las pantallas del menú del rol) y «corto» (solo lo esencial del rol). */
export const MODOS = Object.freeze(['corto', 'completo']);
/**
 * Selección del recorrido corto por pista: [ruta, pasos que se muestran de esa pantalla]. Las pantallas deben estar en el menú del rol (si no, se omiten).
 * Con el cierre suman 12 pasos por rol. Los ids de paso son los mismos que en el recorrido completo: lo guardado vale en ambos modos.
 *  - Propietario: Hoy, Pregúntale, Problemas, Fuentes (conexiones) y Equipo.
 *  - Analista: Hoy, Pregúntale, Problemas, Recomendaciones y Fuentes (conexiones).
 *  - Operador: Hoy, Pregúntale, Problemas, Recomendaciones e Intervenciones.
 *  - Lector: Hoy, Pregúntale, Problemas, Confianza y Fuentes.
 * La pista de plataforma ya es corta y no tiene versión reducida.
 */
export const ESENCIALES = Object.freeze({
  propietario: [['/overview', ['ir', 'que', 'clave']], ['/preguntale', ['ir', 'que']], ['/problems', ['ir', 'que']], ['/connections', ['ir', 'que']], ['/settings/team', ['ir', 'que']]],
  analista: [['/overview', ['ir', 'que', 'clave']], ['/preguntale', ['ir', 'que']], ['/problems', ['ir', 'que']], ['/recommendations', ['ir', 'que']], ['/connections', ['ir', 'que']]],
  operador: [['/overview', ['ir', 'que', 'clave']], ['/preguntale', ['ir', 'que']], ['/problems', ['ir', 'que']], ['/recommendations', ['ir', 'que']], ['/interventions', ['ir', 'que']]],
  lector: [['/overview', ['ir', 'que', 'clave']], ['/preguntale', ['ir', 'que']], ['/problems', ['ir', 'que']], ['/confianza', ['ir', 'que']], ['/sources', ['ir', 'que']]],
});

const objetivoMenu = (pista, href) => [`[data-tour="${pista === 'plataforma' ? 'plataforma:' : 'menu:'}${href}"]`];

/**
 * @returns {Array<{id:string,tipo:'ir'|'info'|'cierre',clave:string,pantalla:string|null,grupo:number,href:string|null,ilu:string,objetivos:readonly string[],titulo:string|null,cuerpo:string|null,catalogo:string|null}>}
 * `titulo` null = usar el nombre de la pantalla (el de su ítem de menú en el idioma activo).
 */
export function construirTour(pista, modo = 'completo') {
  const hrefs = pantallasDe(pista);
  if (hrefs.length === 0) return [];
  const rol = ROL_DE_PISTA[pista];
  const delCatalogo = new Map(pasosDe(pista, 'tour').filter((p) => p.href).map((p) => [p.href, p]));
  const pasos = [];
  hrefs.forEach((href, grupo) => {
    const def = PANTALLAS[href], slug = slugDe(href), c = delCatalogo.get(href);
    const base = { pantalla: href, grupo, href, ilu: def.ilu, catalogo: c?.id ?? null };
    pasos.push({ ...base, id: `${slug}.ir`, tipo: 'ir', clave: 'ir', objetivos: objetivoMenu(pista, href), titulo: null, cuerpo: null });
    pasos.push({ ...base, id: `${slug}.que`, tipo: 'info', clave: 'que', objetivos: (c && OBJETIVOS[c.id]) || QUE, titulo: c ? c.textos.titulo : null, cuerpo: c ? c.textos.cuerpo : `onb.pant.${slug}.desc` });
    pasos.push({ ...base, id: `${slug}.clave`, tipo: 'info', clave: 'clave', objetivos: def.clave, titulo: `onb.pant.${slug}.claveT`, cuerpo: `onb.pant.${slug}.claveC` });
    if (def.accion && (!rol || rolTieneCapacidad(rol, def.accion.capacidad))) pasos.push({ ...base, id: `${slug}.accion`, tipo: 'info', clave: 'accion', objetivos: def.accion.objetivos, titulo: `onb.pant.${slug}.accionT`, cuerpo: `onb.pant.${slug}.accionC` });
  });
  const elegidos = modo === 'corto' ? ESENCIALES[pista] : null;
  if (elegidos) {
    const vistas = elegidos.filter(([href]) => hrefs.includes(href));
    const cortos = [];
    vistas.forEach(([href, claves], g) => { for (const p of pasos) if (p.pantalla === href && claves.includes(p.clave)) cortos.push({ ...p, grupo: g }); });
    pasos.length = 0;
    pasos.push(...cortos);
    hrefs.length = vistas.length;
  }
  pasos.push({ id: 'cierre', tipo: 'cierre', clave: 'cierre', pantalla: null, grupo: hrefs.length, href: null, ilu: 'cierre', objetivos: [], titulo: 'onb.tour.cierre.titulo', cuerpo: 'onb.tour.cierre.cuerpo', catalogo: null });
  return pasos;
}

/** Pantallas del recorrido en orden, con el índice de su primer paso: {href, grupo, desde}. */
export function gruposDe(pasos) {
  const salida = [];
  pasos.forEach((p, i) => { if (p.pantalla && !salida.some((g) => g.href === p.pantalla)) salida.push({ href: p.pantalla, grupo: p.grupo, desde: i }); });
  return salida;
}
