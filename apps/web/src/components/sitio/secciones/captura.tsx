// Captura real del producto (datos de ejemplo) del manifest: AVIF con respaldo WebP, ancho y alto del original y el alt del idioma.
// Las capturas están en español; en inglés se usan las mismas con el alt en inglés (el capturador no genera variante EN).
import {alt, medidas, url, urlAvif} from '../../../lib/sitio/activos';

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
