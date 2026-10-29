'use client';
import {useEffect, useState} from 'react';
// Movimiento de la landing. Reglas de la política de seguridad: ningún atributo style en el marcado ni script en línea.
// GSAP 3.13.0, ScrollTrigger y Lenis 1.1.13 se sirven desde el mismo dominio (public/vendor) y se cargan solo aquí, después del primer pintado.
// Aquí solo se escriben propiedades con la API del objeto style (CSSOM) y atributos de datos. Con movimiento reducido no se carga nada.

const REDUCIDO = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
type Gsap = {registerPlugin(...p: unknown[]): void; set(t: unknown, v: object): void; to(t: unknown, v: object): unknown; from(t: unknown, v: object): unknown; ticker: {add(f: (t: number) => void): void; remove(f: (t: number) => void): void; lagSmoothing(n: number): void}; context(f: () => void): {revert(): void}; utils: {toArray(s: string): HTMLElement[]; clamp(a: number, b: number, v: number): number}};
type Disparador = {create(v: object): {kill(): void}; update(): void; refresh(): void};
type LenisT = {raf(t: number): void; on(e: string, f: () => void): void; scrollTo(t: unknown, o?: object): void; destroy(): void};
declare global { interface Window {gsap?: Gsap; ScrollTrigger?: Disparador; Lenis?: new (o?: object) => LenisT} }

function cargar(src: string) {
  return new Promise<void>((ok, fallo) => {
    const s = document.createElement('script');
    s.src = src; s.async = false; s.onload = () => ok(); s.onerror = () => fallo(new Error(src));
    document.head.appendChild(s);
  });
}

export function MovimientoLanding() {
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.setAttribute('data-landing-js', '');
    if (!raiz.dataset.theme && window.matchMedia('(prefers-color-scheme: dark)').matches) raiz.dataset.theme = 'dark';
    const el = <T extends Element>(sel: string) => Array.from(document.querySelectorAll<T>(sel));
    const limpiar: Array<() => void> = [() => raiz.removeAttribute('data-landing-js')];
    let vivo = true;

    // Escena de los cuatro pasos: respaldo sin librerías con centinelas. GSAP mejora el movimiento, pero el paso activo nunca depende de él.
    const escena = document.querySelector<HTMLElement>('[data-escena]');
    if (escena) {
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) escena.dataset.activo = (e.target as HTMLElement).dataset.centinela ?? '1'; }), {rootMargin: '-50% 0px -50% 0px'});
      el('[data-centinela]').forEach((c) => io.observe(c));
      limpiar.push(() => io.disconnect());
    }
    if (REDUCIDO()) return () => limpiar.forEach((f) => f());

    // Movimiento premium: se carga tras el primer pintado y solo en la landing.
    const arranque = async () => {
      try {
        await cargar('/vendor/gsap-3.13.0.min.js'); await cargar('/vendor/ScrollTrigger-3.13.0.min.js'); await cargar('/vendor/lenis-1.1.13.min.js');
      } catch { return; }
      const {gsap, ScrollTrigger, Lenis} = window;
      if (!vivo || !gsap || !ScrollTrigger || !Lenis) return;
      gsap.registerPlugin(ScrollTrigger);
      const lenis = new Lenis({lerp: 0.1, smoothWheel: true});
      lenis.on('scroll', () => ScrollTrigger.update());
      const tick = (t: number) => lenis.raf(t * 1000);
      gsap.ticker.add(tick); gsap.ticker.lagSmoothing(0);
      const alto = () => (document.querySelector('.l-nav')?.getBoundingClientRect().height ?? 56);
      const alClic = (ev: MouseEvent) => {
        const a = (ev.target as Element).closest?.('a[href^="#"]') as HTMLAnchorElement | null;
        const id = a?.getAttribute('href')?.slice(1);
        const dest = id ? document.getElementById(id) : null;
        if (!a || !dest) return;
        ev.preventDefault(); lenis.scrollTo(dest, {offset: -alto()});
        history.replaceState(null, '', '#' + id);
      };
      document.addEventListener('click', alClic);

      const ctx = gsap.context(() => {
        // Entrada del hero: el titular nunca se oculta (LCP); solo sube unos píxeles. El resto aparece escalonado.
        gsap.from('[data-in="0"]', {y: 18, duration: 0.9, ease: 'expo.out'});
        gsap.from('[data-in="1"],[data-in="2"],[data-in="3"]', {autoAlpha: 0, y: 14, duration: 0.8, ease: 'power3.out', stagger: 0.12, delay: 0.15});
        // Revelados al entrar en vista: solo lo que está por debajo del primer viewport.
        const vh = window.innerHeight;
        gsap.utils.toArray('[data-rv]').forEach((n) => {
          if (n.getBoundingClientRect().top < vh) return;
          gsap.set(n, {autoAlpha: 0, y: 28});
          ScrollTrigger.create({trigger: n, start: 'top 88%', once: true, onEnter: () => gsap.to(n, {autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out', clearProps: 'transform,opacity,visibility'})});
        });
        // Objetos 3D reales (módulo propio con three.js, mismo origen): el scroll solo escribe datos que la escena lee con inercia.
        const nucleo = document.querySelector<HTMLElement>('canvas[data-escena3d="nucleo"]'), pasos = document.querySelector<HTMLElement>('canvas[data-escena3d="pasos"]');
        if (nucleo) ScrollTrigger.create({trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true, onUpdate: (s: {progress: number}) => { nucleo.dataset.p = s.progress.toFixed(4); }});
        if (nucleo || pasos) {
          const m = document.createElement('script'); m.type = 'module'; m.src = '/landing/escena.js'; document.head.appendChild(m);
          limpiar.push(() => m.remove());
        }
        // Escena fija: el objeto activo sube a su sitio y los demás se apartan; el progreso ligado al scroll gira el objeto sutilmente.
        if (escena) {
          ScrollTrigger.create({trigger: escena, start: () => 'top ' + alto(), end: 'bottom bottom', scrub: 0.5,
            onUpdate: (s: {progress: number}) => {
              // El progreso 0 a 1 es lo único que se escribe: el texto, la cifra y el 3D se sincronizan con él.
              const i = Math.min(3, Math.round(s.progress * 3));
              escena.dataset.activo = String(i + 1);
              if (pasos) { pasos.dataset.activo = String(i + 1); pasos.dataset.c = s.progress.toFixed(4); }
            }});
        }
      });
      limpiar.push(() => { ctx.revert(); document.removeEventListener('click', alClic); gsap.ticker.remove(tick); lenis.destroy(); });
      window.addEventListener('load', () => ScrollTrigger.refresh(), {once: true});
    };
    const arrancar = () => { void arranque(); };
    if (document.readyState === 'complete') window.setTimeout(arrancar, 50); else window.addEventListener('load', () => window.setTimeout(arrancar, 50), {once: true});
    return () => { vivo = false; limpiar.forEach((f) => f()); };
  }, []);
  return null;
}

/** Botón de tema claro u oscuro: misma preferencia guardada que la app («vexa-theme»). */
export function SelectorTemaLanding({etiqueta}: {etiqueta: string}) {
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => {
    const leer = () => setOscuro(document.documentElement.dataset.theme === 'dark');
    leer();
    const mo = new MutationObserver(leer);
    mo.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
    return () => mo.disconnect();
  }, []);
  function alternar() {
    const siguiente = oscuro ? 'light' : 'dark';
    document.documentElement.dataset.theme = siguiente;
    try { window.localStorage.setItem('vexa-theme', siguiente); } catch { /* la preferencia es opcional */ }
    document.querySelectorAll('meta[name=theme-color]').forEach((m) => m.setAttribute('content', siguiente === 'dark' ? '#0e0e10' : '#ffffff'));
  }
  return <button type="button" className="c-tema-btn" aria-label={etiqueta} aria-pressed={oscuro} onClick={alternar}>
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><path className="l-tema-luna" d="M16.5 11.6A7 7 0 0 1 8.4 3.5a7 7 0 1 0 8.1 8.1z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
  </button>;
}

