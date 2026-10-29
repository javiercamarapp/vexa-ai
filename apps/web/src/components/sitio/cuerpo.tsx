// Renderizador de bloques tipados de las páginas internas (T7). Lee el árbol que devuelve publicar() (T11), nunca el contenido directo:
// una hoja no publicable ya viene omitida, los marcadores resueltos y los alternos aplicados. Marcado con las clases s-* de T6 y las
// pocas piezas de páginas internas de shell/paginas.css.
//
// Bloques: texto, lista, limites, tarjetas, principios, enlaces, matriz, preguntas, cifras y sellos.
// Una hoja MATIZ lleva data-nivel="matiz" y data-condicion con su n; su condición escrita viaja dentro del propio texto (n de 1 a 13) o,
// para n = 0, en las hojas acompañantes que publicar() ya garantiza publicables. Un bloque desconocido rompe el build: nada se descarta en silencio.
import type {ReactNode} from 'react';
import {cierre, hrefAcceso, hrefMailto, paginaPublicada, rutaPublicable} from './shell/datos';
import type {HojaPub, Lang, PaginaPublicada} from './shell/datos';
import type {Pagina} from '../../content/sitio/tipos';

type Obj = Record<string, unknown>;
const esHoja = (x: unknown): x is HojaPub => typeof x === 'object' && x !== null && typeof (x as HojaPub).es === 'string' && typeof (x as HojaPub).en === 'string';
const lista = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

/** Atributos de una hoja MATIZ. Vacío para el resto. */
function marca(h: unknown): Record<string, string> {
  return esHoja(h) && h.nivel === 'MATIZ' ? {'data-nivel': 'matiz', 'data-condicion': String(h.condicion?.n ?? '')} : {};
}

function txt(h: unknown, lang: Lang): string {
  if (typeof h === 'string') return h;
  if (esHoja(h)) return h[lang];
  return '';
}

function Titulo({b, lang}: {b: Obj; lang: Lang}) {
  return esHoja(b.titulo) ? <h2 className="s-h3-serif s-pag-titulo">{txt(b.titulo, lang)}</h2> : null;
}

function Bloque({b, lang}: {b: Obj; lang: Lang}): ReactNode {
  const tipo = b.tipo as string;
  switch (tipo) {
    case 'texto':
      return (
        <>
          <Titulo b={b} lang={lang} />
          <p className="s-cuerpo" {...marca(b.texto)}>{txt(b.texto, lang)}</p>
        </>
      );
    case 'lista':
    case 'limites':
      return (
        <>
          <Titulo b={b} lang={lang} />
          <ul className="s-lista">
            {lista(b.items).map((it, i) => (
              <li key={i} {...marca(it)}>{txt(it, lang)}</li>
            ))}
          </ul>
        </>
      );
    case 'tarjetas':
    case 'principios':
      return (
        <>
          <Titulo b={b} lang={lang} />
          <div className="s-columnas s-pag-tarjetas">
            {lista(b.items).map((it, i) => {
              const o = it as Obj;
              return (
                <article className="s-tarjeta s-tarjeta--capacidad" key={i}>
                  <h3 className="s-h3-producto">{txt(o.n ?? o.t, lang)}</h3>
                  {esHoja(o.d) ? <p className="s-pequeno s-apagado" {...marca(o.d)}>{txt(o.d, lang)}</p> : null}
                </article>
              );
            })}
          </div>
        </>
      );
    case 'enlaces': {
      // Solo enlaces a páginas que se publican.
      const items = lista(b.items).filter((it) => rutaPublicable((it as {href: Record<Lang, string>}).href));
      if (items.length === 0) return null;
      return (
        <>
          <Titulo b={b} lang={lang} />
          <div className="s-columnas s-pag-tarjetas">
            {items.map((it, i) => {
              const o = it as {t: HojaPub; d?: HojaPub; href: Record<Lang, string>};
              return (
                <a className="s-tarjeta s-tarjeta--capacidad s-pag-enlace" href={o.href[lang]} key={i}>
                  <span className="s-h3-producto">{txt(o.t, lang)}</span>
                  {o.d ? <span className="s-pequeno s-apagado" {...marca(o.d)}>{txt(o.d, lang)}</span> : null}
                </a>
              );
            })}
          </div>
        </>
      );
    }
    case 'matriz': {
      const columnas = lista(b.columnas);
      return (
        <>
          <Titulo b={b} lang={lang} />
          <div className="s-pag-tabla-caja">
            <table className="s-pag-tabla">
              <thead>
                <tr>
                  <td />
                  {columnas.map((c, i) => (
                    <th scope="col" key={i}>{txt(c, lang)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista(b.filas).map((f, i) => {
                  const o = f as Obj;
                  return (
                    <tr key={i}>
                      <th scope="row">{txt(o.t, lang)}</th>
                      {lista(o.celdas).map((c, j) => (
                        <td key={j}>{txt(c, lang)}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      );
    }
    case 'preguntas':
      return (
        <>
          <Titulo b={b} lang={lang} />
          <div className="s-pila-24">
            {lista(b.items).map((it, i) => {
              const o = it as Obj;
              return (
                <div className="s-pag-pregunta" key={i}>
                  <h3 className="s-h3-producto" {...marca(o.q)}>{txt(o.q, lang)}</h3>
                  <p className="s-cuerpo" {...marca(o.a)}>{txt(o.a, lang)}</p>
                </div>
              );
            })}
          </div>
        </>
      );
    case 'cifras':
      return (
        <>
          <Titulo b={b} lang={lang} />
          <div className="s-hechos">
            {lista(b.items).map((it, i) => {
              const o = it as Obj;
              return (
                <div key={i} {...marca(o.v)}>
                  <span className="s-cifra s-tabular">{txt(o.v, lang)}</span> {txt(o.e, lang)}
                </div>
              );
            })}
          </div>
        </>
      );
    case 'sellos':
      return (
        <>
          <Titulo b={b} lang={lang} />
          <div className="s-sellos">
            {lista(b.items).map((it, i) => {
              const o = it as Obj;
              const clase = ['observado', 'estimado', 'inferido', 'sindato'].includes(o.clase as string) ? (o.clase as string) : 'sindato';
              return (
                <span className={`s-sello s-sello--${clase}`} key={i}>
                  <span className="s-sello__icono" aria-hidden="true" />
                  {txt(o.t, lang)}
                </span>
              );
            })}
          </div>
        </>
      );
    default:
      throw new Error(`BLOQUE_DESCONOCIDO: ${String(tipo)}`);
  }
}

type Props = {
  pagina: Pagina;
  lang: Lang;
  /**
   * Estado de publicación de la página. Con publicable = false se añade la nota de revisión pendiente (motivos) y no hay
   * nada que indexar: la ruta además declara noindex. El despachador solo rinde páginas publicables; esta rama sirve a la revisión interna.
   */
  publicable?: boolean;
  motivos?: readonly string[];
};

export function CuerpoPagina({pagina, lang, publicable = true, motivos = []}: Props) {
  const p: PaginaPublicada = paginaPublicada(pagina);
  const bloques = p.bloques.map((b, i) => (
    <div className="s-pag-bloque" data-bloque={b.tipo as string} key={i}>
      <Bloque b={b} lang={lang} />
    </div>
  ));
  const etiquetaNota = lang === 'es' ? 'Pendiente de revisión' : 'Pending review';
  const c = cierre(lang);
  const esAcceso = pagina.id === 'solicitar-acceso';
  const botonHref = esAcceso ? (hrefMailto(lang) ?? hrefAcceso(lang)) : hrefAcceso(lang);
  const textoBoton = p.cta ? txt(p.cta, lang) : lang === 'es' ? 'Solicitar acceso' : 'Request access';
  const Boton = (
    <a className="s-boton" href={botonHref}>
      {textoBoton}
      <span className="s-boton__circulo">
        <span className="s-flecha" aria-hidden="true" />
      </span>
    </a>
  );
  return (
    <>
      <section className="s-seccion s-pag-cabeza" data-tema="oscuro">
        <div className="s-contenedor s-pila-24">
          {!publicable ? (
            <p className="s-eyebrow" role="note" data-estado="pendiente">
              {etiquetaNota}
              {motivos.length ? `: ${motivos.join('; ')}` : ''}
            </p>
          ) : null}
          <h1 className="s-h2-grande s-ancho-titular" {...marca(p.h1)}>{txt(p.h1, lang)}</h1>
          <p className="s-lead" {...marca(p.subtitulo)}>{txt(p.subtitulo, lang)}</p>
          {esAcceso ? Boton : null}
        </div>
      </section>
      <section className="s-seccion s-costura s-costura--a-claro" data-tema="claro">
        <div className="s-contenedor s-pag-contenido">
          {bloques}
          {p.rotulo ? <p className="s-rotulo-ejemplo">{txt(p.rotulo, lang)}</p> : null}
        </div>
      </section>
      {esAcceso ? null : (
        <section className="s-seccion s-cierre s-costura s-costura--a-oscuro" data-tema="oscuro">
          <div className="s-contenedor s-cierre__contenido">
            <h2 className="s-h2">{c.titulo}</h2>
            <p className="s-cierre__texto">{c.texto}</p>
            {Boton}
            <p className="s-cierre__precio s-mono-min">{c.precio}</p>
          </div>
        </section>
      )}
    </>
  );
}
