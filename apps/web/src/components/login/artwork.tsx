'use client';
import {useEffect, useRef} from 'react';
import {mountLoginParticles} from './particle-engine';

/** Mount only at desktop sizes; dispose observers and animation on navigation. */
export function LoginArtwork() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const media = matchMedia('(min-width: 1024px)');
    let dispose: (() => void) | undefined;
    let cancelled = false;
    const sync = () => {
      dispose?.();
      dispose = undefined;
      if (media.matches && canvas.current && !cancelled) {
        dispose = mountLoginParticles(canvas.current, 'sphere', true);
      }
    };
    // Build the glyph atlas with the real font, including on a cold visit.
    void document.fonts.load('36px "Rovaq Login Mono"').then(sync, sync);
    media.addEventListener('change', sync);
    return () => { cancelled = true; media.removeEventListener('change', sync); dispose?.(); };
  }, []);
  return <div className="login-artwork" aria-hidden="true"><canvas ref={canvas}/><div className="login-artwork-floor"/></div>;
}
