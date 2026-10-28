// Utilidades de DOM del recorrido: encontrar el elemento real de un paso (esperando a que exista), abrir el grupo del menú que lo esconde y medirlo.
// Solo CSSOM y atributos: nunca estilos en línea escritos en el marcado (CSP).
const visible = (el: Element): el is HTMLElement => el instanceof HTMLElement && el.getClientRects().length > 0;

/** Primer elemento visible de los selectores (el orden manda). Un selector inválido se ignora. */
export function primerVisible(selectores: readonly string[]): HTMLElement | null {
  for (const s of selectores) {
    let lista: Element[] = [];
    try { lista = Array.from(document.querySelectorAll(s)); } catch { continue; }
    const el = lista.find(visible);
    if (el) return el;
  }
  return null;
}
/** Si el enlace del menú vive en un grupo plegado, lo despliega (el menú es un acordeón). Devuelve true si hizo clic en el botón del grupo. */
export function abrirGrupoDelMenu(selectores: readonly string[]): boolean {
  for (const s of selectores) {
    let lista: Element[] = [];
    try { lista = Array.from(document.querySelectorAll(s)); } catch { continue; }
    for (const el of lista) {
      const ul = el.closest('ul[hidden]');
      if (!ul || !ul.id) continue;
      const boton = document.querySelector<HTMLElement>(`button[aria-controls="${CSS.escape(ul.id)}"]`);
      if (boton && visible(boton)) { boton.click(); return true; }
    }
  }
  return false;
}
export const reducirMovimiento = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const pantallaEstrecha = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches;

/**
 * Espera a que aparezca el elemento de un paso: lo busca ya y, si no está, cada vez que el DOM cambia, hasta `tope` ms (4 s). Si no aparece llama a `alAgotar` y el paso se degrada a tarjeta centrada.
 * Devuelve la función que cancela la espera.
 */
export function esperarObjetivo(selectores: readonly string[], alEncontrar: (el: HTMLElement) => void, alAgotar: () => void, tope = 4000): () => void {
  let fin = false, observador: MutationObserver | null = null, temporizador: ReturnType<typeof setTimeout> | undefined, cuadro = 0; // eslint-disable-line prefer-const
  const terminar = () => { fin = true; observador?.disconnect(); if (temporizador) clearTimeout(temporizador); if (cuadro) cancelAnimationFrame(cuadro); };
  const intentar = () => { cuadro = 0; if (fin) return; const el = primerVisible(selectores); if (el) { terminar(); alEncontrar(el); } };
  if (selectores.length === 0) { const id = setTimeout(() => { if (!fin) { terminar(); alAgotar(); } }, 0); return () => { terminar(); clearTimeout(id); }; }
  const ya = primerVisible(selectores);
  if (ya) { const id = setTimeout(() => { if (!fin) { terminar(); alEncontrar(ya); } }, 0); return () => { terminar(); clearTimeout(id); }; }
  observador = new MutationObserver(() => { if (!cuadro) cuadro = requestAnimationFrame(intentar); });
  observador.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  temporizador = setTimeout(() => { if (!fin) { terminar(); alAgotar(); } }, tope);
  return terminar;
}
/** Nombre real del elemento (lo que dice su etiqueta o su texto), recortado. */
export function nombreDe(el: HTMLElement): string {
  const crudo = el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '';
  const limpio = crudo.replace(/\s+/g, ' ').trim();
  return limpio.length > 40 ? limpio.slice(0, 39).trimEnd() + '…' : limpio;
}
