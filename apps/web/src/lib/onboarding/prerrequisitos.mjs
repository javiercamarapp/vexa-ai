// Estado honesto de cada paso del checklist, derivado de señales reales de la organización (nunca guardado).
// Entrada: `senales` = booleanos que calcula el servidor (lib/onboarding/servidor.ts) con EXISTS baratos; null = no se pudo leer.
// Estados: hecho · salvedad (hecho con una reserva honesta) · esperando (depende de un tercero) · bloqueado (falta algo previo) · pendiente · informativo (no se puede derivar) · desconocido.
// Los pasos que dependen de un tercero (PRERREQUISITOS[..].tercero) y los informativos NO cuentan en el progreso ni son el «siguiente recomendado».
import { pasosDe, PRERREQUISITOS } from './catalogo.mjs';

export const MAX_VISIBLES = 4;
export const CLAVES_SENALES = Object.freeze(['conexion_activa', 'conexion_con_problema', 'historial_importado', 'corte_publicado', 'equipo_invitado', 'accion_propuesta', 'hay_intervenciones', 'resultado_registrado', 'pedidos_cargados', 'pedidos_ligados']);

/** Normaliza lo que llega de la red: solo booleanos conocidos; todo lo demás se ignora. */
export function normalizarSenales(crudo) {
  if (!crudo || typeof crudo !== 'object') return null;
  const s = {};
  for (const k of CLAVES_SENALES) s[k] = crudo[k] === true;
  return s;
}

const TERCERO_TEXTO = Object.freeze({ crm: 'onb.tercero.crm', correo: 'onb.tercero.correo', propietario: 'onb.tercero.propietario', push: 'onb.tercero.push' });

/**
 * Estado de un paso con prerrequisito.
 * @returns {{estado:string, cuenta:boolean, esperaA:string|null, nota:string|null}} esperaA/nota = claves i18n.
 */
export function estadoDePaso(paso, senales) {
  const pre = paso.prerrequisito;
  if (!pre) return { estado: 'informativo', cuenta: false, esperaA: null, nota: null };
  if (!senales) return { estado: 'desconocido', cuenta: false, esperaA: null, nota: null };
  const tercero = paso.espera ?? PRERREQUISITOS[pre]?.tercero ?? null;
  const hecho = senales[pre] === true;
  if (tercero) return hecho ? { estado: 'hecho', cuenta: false, esperaA: null, nota: null } : { estado: 'esperando', cuenta: false, esperaA: TERCERO_TEXTO[tercero], nota: null };
  if (hecho) {
    // El dinero publicado nunca se presenta como conciliado mientras no haya un indicador barato y verificable de pedidos ligados.
    if (pre === 'corte_publicado') return { estado: 'salvedad', cuenta: true, esperaA: null, nota: 'onb.check.concil' };
    // Que exista algún pedido ligado nunca es «conciliado»: la cobertura completa no se puede leer barato, así que siempre va con salvedad.
    if (pre === 'pedidos_ligados') return { estado: 'salvedad', cuenta: true, esperaA: null, nota: 'onb.setup.conc.salvedad' };
    return { estado: 'hecho', cuenta: true, esperaA: null, nota: null };
  }
  if (pre === 'corte_publicado' && !senales.historial_importado && !senales.conexion_activa) return { estado: 'bloqueado', cuenta: true, esperaA: null, nota: 'onb.check.bloq.sinDatos' };
  if (pre === 'resultado_registrado' && !senales.hay_intervenciones) return { estado: 'bloqueado', cuenta: true, esperaA: null, nota: 'onb.check.bloq.sinIntervencion' };
  return { estado: 'pendiente', cuenta: true, esperaA: null, nota: null };
}

const HECHOS = new Set(['hecho', 'salvedad']);
/**
 * Checklist de una pista: items en el orden del catálogo, los primeros `maxVisibles` visibles y el resto plegado.
 * progreso = hechos / total SOLO entre pasos propios (sin terceros ni informativos). siguiente = primer paso pendiente (no bloqueado, no de tercero).
 */
export function calcularChecklist(pista, senales, { maxVisibles = MAX_VISIBLES } = {}) {
  const items = pasosDe(pista, 'checklist').map((paso) => ({ id: paso.id, href: paso.href, textos: paso.textos, ...estadoDePaso(paso, senales) }));
  const propios = items.filter((i) => i.cuenta);
  const hechos = propios.filter((i) => HECHOS.has(i.estado)).length;
  const siguiente = senales ? (items.find((i) => i.estado === 'pendiente')?.id ?? null) : null;
  return { items, visibles: items.slice(0, maxVisibles), plegados: items.slice(maxVisibles), progreso: { hechos, total: propios.length }, siguiente, completo: propios.length > 0 && hechos === propios.length };
}
