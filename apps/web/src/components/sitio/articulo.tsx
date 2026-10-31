// Renderizador de un artículo del blog (T24). Lee el árbol que devuelve publicar() (T11), nunca el contenido directo, igual que cuerpo.tsx.
// Reutiliza el shell, los tokens s- y los componentes de las páginas internas. Sin imágenes: el texto manda. Ancho de lectura de unos 68 caracteres.
// Los bloques son los de BloqueArticulo (tipos.ts): p, h2, h3, lista, pasos, cita y no-afirmamos. Un bloque desconocido rompe el build.
import {Fragment} from 'react';
import type {ReactNode} from 'react';
import {SeccionCierre} from './cuerpo';
import {esPublicable, hrefDe, paginaPublicada, relacionadosDe} from './shell/datos';
import type {HojaPub, Lang} from './shell/datos';
import type {Articulo} from '../../content/sitio/tipos';
import {porId} from '../../content/sitio/registro.mjs';
import {ANCLA_NO_AFIRMAMOS, ROTULO_NO_AFIRMAMOS, fechaLegible, minutosDeLectura, partirEnlaces, partirNegrita, rotuloLectura, seccionesDe} from '../../lib/sitio/articulos.mjs';

type Obj = Record<string, unknown>;
const esHoja = (x: unknown): x is HojaPub => typeof x === 'object' && x !== null && typeof (x as HojaPub).es === 'string' && typeof (x as HojaPub).en === 'string';
const txt = (h: unknown, lang: Lang): string => (typeof h === 'string' ? h : esHoja(h) ? h[lang] : '');
const lista = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

const TEXTO = {
  es: {
    blog: 'Blog',
    autor: 'Rovaq AI',
    tabla: 'En este artículo',
    relacionados: 'Sigue leyendo',
    tipos: {articulo: 'Artículo', producto: 'Producto', rol: 'Caso de uso', indice: 'Sección'} as Record<string, string>,
  },
  en: {
    blog: 'Blog',
    autor: 'Rovaq AI',
    tabla: 'In this article',
    relacionados: 'Keep reading',
    tipos: {articulo: 'Article', producto: 'Product', rol: 'Use case', indice: 'Section'} as Record<string, string>,
  },
} as const;

/**
 * Texto con enlaces internos {{id|texto}} y rótulos en negrita **texto**: enlaza solo las páginas que se publican; las demás quedan como texto.
 * Un id fuera del registro rompe el build. El rótulo usa la etiqueta strong, sin color nuevo.
 */
function Rico({t, lang}: {t: string; lang: Lang}) {
  return (
    <>
      {partirNegrita(t).map((parte, k) => {
        const hijos = partirEnlaces(parte.texto).map((x, i) => {
          if (x.id === undefined) return <Fragment key={i}>{x.texto}</Fragment>;
          if (!porId(x.id)) throw new Error(`ENLACE_SIN_REGISTRO: ${x.id}`);
          return esPublicable(x.id) ? <a className="s-enlace" href={hrefDe(x.id, lang)} key={i}>{x.texto}</a> : <Fragment key={i}>{x.texto}</Fragment>;
        });
        return parte.negrita ? <strong className="s-art__rotulo" key={k}>{hijos}</strong> : <Fragment key={k}>{hijos}</Fragment>;
      })}
    </>
  );
}

function Bloque({b, lang, ancla}: {b: Obj; lang: Lang; ancla?: string}): ReactNode {
  const tipo = b.tipo as string;
  switch (tipo) {
    case 'p':
      return <p className="s-art__p"><Rico t={txt(b.texto, lang)} lang={lang} /></p>;
    case 'h2':
      return <h2 className="s-h3-serif s-art__h2" id={ancla}>{txt(b.texto, lang)}</h2>;
    case 'h3':
      return <h3 className="s-h3-producto s-art__h3" id={ancla}>{txt(b.texto, lang)}</h3>;
    case 'lista':
      return (
        <ul className="s-art__lista">
          {lista(b.items).map((it, i) => <li key={i}><Rico t={txt(it, lang)} lang={lang} /></li>)}
        </ul>
      );
    case 'pasos':
      return (
        <ol className="s-art__lista s-art__lista--num">
          {lista(b.items).map((it, i) => <li key={i}><Rico t={txt(it, lang)} lang={lang} /></li>)}
        </ol>
      );
    case 'cita':
      return (
        <blockquote className="s-art__cita">
          <p><Rico t={txt(b.texto, lang)} lang={lang} /></p>
        </blockquote>
      );
    case 'no-afirmamos':
      return (
        <aside className="s-art__limites" aria-labelledby={ANCLA_NO_AFIRMAMOS[lang]}>
          <h2 className="s-h3-serif s-art__h2" id={ANCLA_NO_AFIRMAMOS[lang]}>{ROTULO_NO_AFIRMAMOS[lang]}</h2>
          <ul className="s-art__lista">
            {lista(b.items).map((it, i) => <li key={i}><Rico t={txt(it, lang)} lang={lang} /></li>)}
          </ul>
        </aside>
      );
    default:
      throw new Error(`BLOQUE_DE_ARTICULO_DESCONOCIDO: ${String(tipo)}`);
  }
}

export function CuerpoArticulo({pagina, lang}: {pagina: Articulo; lang: Lang}) {
  const t = TEXTO[lang];
  const p = paginaPublicada(pagina) as unknown as {h1: HojaPub; subtitulo: HojaPub; bloques: Obj[]; pub: string; cta?: HojaPub};
  const secciones = seccionesDe(p.bloques as never, lang);
  const anclaDe = new Map(secciones.map((s) => [s.indice, s.id]));
  const minutos = minutosDeLectura(p.bloques as never, lang);
  const tieneNota = p.bloques.some((b) => b.tipo === 'no-afirmamos');
  const h2 = secciones.filter((s) => s.nivel === 2);
  // Tabla de contenido ligera: solo con tres o más secciones, para que no sea ruido en un texto corto.
  const toc = [...h2.map((s) => ({id: s.id, texto: s.texto})), ...(tieneNota ? [{id: ANCLA_NO_AFIRMAMOS[lang], texto: ROTULO_NO_AFIRMAMOS[lang]}] : [])];
  const relacionados = relacionadosDe(pagina, lang);
  const textoBoton = p.cta ? txt(p.cta, lang) : lang === 'es' ? 'Solicitar acceso' : 'Request access';
  return (
    <>
      <section className="s-seccion s-pag-cabeza" data-tema="oscuro">
        <div className="s-contenedor s-pila-24">
          <p className="s-eyebrow">
            {esPublicable('blog') ? <a className="s-enlace" href={hrefDe('blog', lang)}>{t.blog}</a> : t.blog}
            {' · '}
            <time dateTime={p.pub}>{fechaLegible(p.pub, lang)}</time>
            {` · ${rotuloLectura(minutos, lang)}`}
          </p>
          <h1 className="s-h2-grande s-ancho-titular">{txt(p.h1, lang)}</h1>
          <p className="s-lead">{txt(p.subtitulo, lang)}</p>
        </div>
      </section>
      <section className="s-seccion" data-tema="claro">
        <div className="s-contenedor">
          <article className="s-art">
            <p className="s-mono-min s-art__autor">{t.autor}</p>
            {toc.length >= 3 ? (
              <nav className="s-art__toc" aria-label={t.tabla}>
                <p className="s-mono-min">{t.tabla}</p>
                <ol>
                  {toc.map((x) => <li key={x.id}><a className="s-enlace" href={`#${x.id}`}>{x.texto}</a></li>)}
                </ol>
              </nav>
            ) : null}
            <div className="s-art__cuerpo">
              {p.bloques.map((b, i) => <Bloque b={b} lang={lang} ancla={anclaDe.get(i)} key={i} />)}
            </div>
            {relacionados.length > 0 ? (
              <nav className="s-art__relacionados" aria-labelledby="relacionados">
                <h2 className="s-h3-serif s-art__h2" id="relacionados">{t.relacionados}</h2>
                <ul className="s-lista">
                  {relacionados.map((r) => (
                    <li key={r.id}>
                      <a className="s-enlace" href={r.href}>{r.titulo}</a>
                      <span className="s-mono-min s-art__tipo">{t.tipos[r.tipo] ?? t.tipos.indice}</span>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </article>
        </div>
      </section>
      <SeccionCierre lang={lang} texto={textoBoton} />
    </>
  );
}
