// Captura real del producto (datos de ejemplo) del manifest: AVIF con respaldo WebP, ancho y alto del original y el alt del idioma.
// Las capturas están en español; en inglés se usan las mismas con el alt en inglés (el capturador no genera variante EN).
import type {ReactNode} from 'react';
import {alt, medidas, url, urlAvif} from '../../../lib/sitio/activos';
import {T, UI} from '../mocks/datos';

export type TemaCaptura = 'oscuro' | 'claro';

/** Clave de manifest de una pantalla: producto/<nombre> en claro, producto/<nombre>-oscuro en oscuro. */
export const claveCaptura = (nombre: string, tema: TemaCaptura): string => `img/producto/${nombre}${tema === 'oscuro' ? '-oscuro' : ''}`;

export function Captura({nombre, tema, lang, tamanos, prioridad = false, clase, anchos, clave: claveFija}: {nombre: string; tema?: TemaCaptura; lang: 'es' | 'en'; tamanos: string; prioridad?: boolean; clase?: string; anchos?: number[]; clave?: string}) {
  const clave = claveFija ?? claveCaptura(nombre, tema ?? 'oscuro');
  const {ancho, alto} = medidas(clave);
  const lista = anchos ?? [960, 1440];
  const srcset = (f: (a: number) => string | undefined) => lista.flatMap((a) => { const u = f(a); return u ? [`${u} ${a}w`] : []; }).join(', ');
  const avif = srcset((a) => urlAvif(clave, a));
  const webp = srcset((a) => url(clave, {ancho: a}));
  return (
    <picture>
      {avif ? <source type="image/avif" srcSet={avif} sizes={tamanos} /> : null}
      <source type="image/webp" srcSet={webp} sizes={tamanos} />
      <img
        className={clase}
        src={url(clave, {ancho: lista[lista.length - 1]})}
        width={ancho}
        height={alto}
        alt={alt(clave, lang)}
        decoding="async"
        {...(prioridad ? {fetchPriority: 'high' as const} : {loading: 'lazy' as const})}
      />
    </picture>
  );
}

/** Ventana oscura de producto con la captura real y, encima, las anotaciones del llamador (hijos, posicionados dentro del cuerpo). */
export function VentanaCaptura({nombre, tema = 'oscuro', lang, ruta, tamanos, children}: {nombre: string; tema?: TemaCaptura; lang: 'es' | 'en'; ruta: 'm1' | 'm2' | 'm3' | 'm4' | 'm5' | 'm6'; tamanos: string; children?: ReactNode}) {
  const t = T(lang);
  return (
    <figure className="s-ventana s-ventana--producto">
      <div className="s-ventana__barra s-mock-barra">
        <span className="s-mock-puntos" aria-hidden="true"><span /><span /><span /></span>
        <span className="s-mock-ruta">{UI(lang).rutas[ruta]}</span>
        <span className="s-mock-org">{t.organizacion}</span>
      </div>
      <div className="s-ventana__cuerpo">
        <Captura nombre={nombre} tema={tema} lang={lang} tamanos={tamanos} clase="s-ventana__img" />
        {children}
      </div>
      <p className="s-rotulo-ejemplo s-ventana__rotulo">{t.rotulo}</p>
    </figure>
  );
}
