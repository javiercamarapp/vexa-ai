'use client';
import {useEffect,useId,useLayoutEffect,useSyncExternalStore} from 'react';
import {RovaqLogo} from './rovaq-logo';

/**
 * Pantalla de carga de Rovaq = la de Likida: SOLO el logo, centrado, que «respira» (opacidad .35→1, escala .985→1, 1.6 s, easeOutQuint). Sin texto visible
 * (el mensaje solo lo lee el lector de pantalla) y sin barridos que recorten el logo. Sin movimiento (prefers-reduced-motion): logo estático.
 *
 * UN SOLO LOGO A LA VEZ en toda la pantalla: varias partes de una página pueden estar cargando al mismo tiempo (la franja de Hoy, el resumen, una tarjeta…),
 * pero solo se dibuja una animación. Gana el de página completa sobre el compacto y, entre iguales, el que se montó primero; los demás dejan un hueco vacío
 * (sin texto ni logo) hasta que el ganador desaparece. En el servidor (aún sin coordinación) se pinta normal; en el cliente se resuelve antes de pintar.
 */
const activos = new Map<string, {rango: number; orden: number}>();
const oyentes = new Set<() => void>();
let contador = 0, version = 0;
const avisar = () => { version++; oyentes.forEach(f => f()); };
const suscribir = (f: () => void) => { oyentes.add(f); return () => { oyentes.delete(f); }; };
const instantanea = () => version;
const ganador = () => { let g: {id: string; rango: number; orden: number} | null = null; for (const [id, v] of activos) if (!g || v.rango > g.rango || (v.rango === g.rango && v.orden < g.orden)) g = {id, ...v}; return g?.id ?? null; };
const useEfectoTemprano = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function RovaqCargando({mensaje = 'Cargando…', compacto = false}: {mensaje?: string; compacto?: boolean}) {
  const id = useId();
  useSyncExternalStore(suscribir, instantanea, () => 0);
  useEfectoTemprano(() => { activos.set(id, {rango: compacto ? 0 : 1, orden: ++contador}); avisar(); return () => { activos.delete(id); avisar(); }; }, [id, compacto]);
  const g = ganador();
  if (g !== null && g !== id) return <div className={'rovaq-cargando-hueco' + (compacto ? ' rovaq-cargando-hueco-compacto' : '')} aria-hidden="true"/>;
  return <div role="status" aria-busy="true" aria-live="polite" aria-label={mensaje || 'Cargando'} className={'rovaq-cargando' + (compacto ? ' rovaq-cargando-compacto' : '')}>
    <RovaqLogo variante={compacto ? 'simbolo' : 'horizontal'} ancho={compacto ? 36 : 140} className="rovaq-respira" decorativo espacioLibre={false}/>
  </div>;
}
