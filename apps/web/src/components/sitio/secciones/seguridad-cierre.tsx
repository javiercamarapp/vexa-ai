// S8 Seguridad y límites (oscuro), S9 Integraciones y preguntas (claro) y S10 Cierre (oscuro).
import {url} from '../../../lib/sitio/activos';
import {Diagrama} from '../diagramas';
import {correoAcceso, enlaceInterno, partirOracion} from './datos';
import type {Lang, TextosPortada} from './datos';
import {Boton, ImagenManifest, Palabras, dosCifras} from './piezas';

export function Seguridad({lang, t}: {lang: Lang; t: TextosPortada}) {
  const s = t.seguridad;
  const l = t.limites;
  const hrefSeg = enlaceInterno(s.href);
  const hrefRuta = enlaceInterno(l.href);
  return (
    <section className="s-seccion s-costura s-costura--a-oscuro" id="seguridad" data-seccion="seguridad" data-tema="oscuro" aria-labelledby="seguridad-titulo">
      <div className="s-contenedor">
        <div className="s-seccion__cabeza">
          <p className="s-eyebrow" data-reveal="">{s.etiqueta}</p>
          <h2 className="s-h2 s-ancho-titular" id="seguridad-titulo">{s.titulo}</h2>
        </div>
        <div className="s-orgs" data-reveal=""><Diagrama id="seguridad" lang={lang} /></div>
        <ul className="s-hechos">
          {s.hechos.map((h) => <li key={h}>{h}</li>)}
        </ul>
        <div className="s-seguridad__tarjetas">
          <div className="s-tarjeta s-tarjeta--vidrio" data-reveal="">
            <h3 className="s-h3-producto">{s.hayEtiqueta}</h3>
            <ul className="s-lista">{s.hay.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div className="s-tarjeta s-tarjeta--vidrio" data-reveal="">
            <h3 className="s-h3-producto">{s.noHayEtiqueta}</h3>
            <ul className="s-lista">{s.noHay.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        </div>
        {s.fecha ? <p className="s-seguridad__fecha s-mono-min">{s.fecha}</p> : null}
        {hrefSeg ? <p className="s-mt-32"><a className="s-enlace-flecha" href={hrefSeg}><span>{s.enlace}</span></a></p> : null}

        <div id="limites">
          <div className="s-limites__cabeza">
            <h2 className="s-h2-grande">{l.titulo}</h2>
            <p className="s-lead">{l.subtitulo}</p>
          </div>
          <div className="s-limites">
            {l.items.map((it, i) => {
              const {titulo, resto} = partirOracion(it);
              return (
                <div className="s-limite" data-reveal="linea" key={i}>
                  <span className="s-numeral" aria-hidden="true">{dosCifras(i + 1)}</span>
                  <h3 className="s-limite__titulo">{titulo}</h3>
                  {resto ? <p className="s-limite__texto">{resto}</p> : null}
                </div>
              );
            })}
          </div>
          <p className="s-lead s-mt-48">{l.cierre}</p>
          {hrefRuta ? <p className="s-mt-24"><a className="s-enlace-flecha" href={hrefRuta}><span>{l.enlace}</span></a></p> : null}
        </div>
      </div>
    </section>
  );
}

export function Integraciones({lang, t}: {lang: Lang; t: TextosPortada}) {
  const g = t.integraciones;
  const e = t.micro.etiquetas;
  const hrefInt = enlaceInterno(g.href);
  const hrefRuta = enlaceInterno(g.hrefRuta);
  const preguntas = t.faq.items.filter((x): x is {q: string; a: string} => Boolean(x.q && x.a));
  return (
    <section className="s-seccion s-costura s-costura--a-claro" id="integraciones" data-seccion="integraciones" data-tema="claro" aria-labelledby="integraciones-titulo">
      <div className="s-contenedor">
        <div className="s-seccion__cabeza">
          <p className="s-eyebrow" data-reveal="">{g.etiqueta}</p>
          <h2 className="s-h2 s-ancho-titular" id="integraciones-titulo">{g.titulo}</h2>
          <p className="s-lead s-apagado">{g.subtitulo}</p>
        </div>
        <div className="s-integraciones" data-reveal=""><Diagrama id="integraciones" lang={lang} /></div>
        <ul className="s-integraciones-lista s-lista">
          {g.chipsFila1.map((c) => <li key={c}>{c}. {e.hoy}</li>)}
          {g.chipsFila2.map((c) => <li key={c}>{c}. {e.ruta}</li>)}
        </ul>
        <div className="s-chips">
          {g.chipsFila1.map((c) => <span className="s-chip s-chip--integracion" key={c}>{c}</span>)}
          {g.chipsFila2.map((c) => <span className="s-chip s-chip--integracion" key={c}>{c}</span>)}
          <span className="s-chip">{g.chipEtiquetaRuta}</span>
        </div>
        <div className="s-seguridad__tarjetas">
          <div>
            <h3 className="s-h3-producto">{g.hoyEtiqueta}</h3>
            <ul className="s-lista">{g.hoy.map((x) => <li key={x.n}><b>{x.n}.</b> {x.d}</li>)}</ul>
          </div>
          <div>
            <h3 className="s-h3-producto">{g.rutaEtiqueta}</h3>
            <ul className="s-lista">{g.ruta.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        </div>
        {g.posicion ? <p className="s-lead s-apagado s-lectura">{g.posicion}</p> : null}
        {hrefInt || hrefRuta ? (
          <p className="s-fila s-mt-24">
            {hrefInt ? <a className="s-enlace-flecha" href={hrefInt}><span>{g.enlace}</span></a> : null}
            {hrefRuta ? <a className="s-enlace-flecha" href={hrefRuta}><span>{g.enlaceRuta}</span></a> : null}
          </p>
        ) : null}

        <div className="s-faq__cabeza s-mt-96">
          <h2 className="s-h2">{t.faq.titulo}</h2>
        </div>
        <div className="s-acordeon">
          {preguntas.map((x, i) => (
            <div className="s-acordeon__item" {...(i === 0 ? {'data-abierto': ''} : {})} key={x.q}>
              <h3 className="s-acordeon__titulo">
                <button className="s-acordeon__boton" type="button" id={`faq-${i + 1}-boton`} aria-expanded={i === 0} aria-controls={`faq-${i + 1}-panel`}>
                  {x.q}
                  <span className="s-acordeon__signo" aria-hidden="true" />
                </button>
              </h3>
              <div className="s-acordeon__panel" id={`faq-${i + 1}-panel`} role="region" aria-labelledby={`faq-${i + 1}-boton`}>
                <div className="s-acordeon__interior"><p>{x.a}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Cierre({lang, t}: {lang: Lang; t: TextosPortada}) {
  const c = t.cierre;
  const correo = correoAcceso(lang);
  return (
    <section className="s-seccion s-cierre s-costura s-costura--a-oscuro" id="cierre" data-seccion="cierre" data-tema="oscuro" aria-labelledby="cierre-titulo">
      <div className="s-cierre__objeto" aria-hidden="true">
        <canvas className="s-nube" data-nube="cierre" data-estado="cargando" data-pts={url('pts/hero')} />
        <ImagenManifest clave="img/hero" lang={lang} clase="s-poster" tamanos="560px" textoAlt={c.objetoAlt} />
      </div>
      <div className="s-contenedor s-cierre__contenido">
        <h2 className="s-h2-grande s-centrado s-ancho-titular" id="cierre-titulo" data-palabras="">
          <Palabras texto={c.titulo} />
        </h2>
        <p className="s-lead s-cierre__texto" data-reveal="blur">{c.texto}</p>
        <div className="s-fila s-fila--centro">
          <Boton href={correo}>{c.cta}</Boton>
          <Boton href="#limites" secundario>{c.ctaSecundario}</Boton>
        </div>
        <ul className="s-cierre__lista">{c.incluir.map((x) => <li key={x}>{x}</li>)}</ul>
        <p className="s-sutil s-mono-min">{c.ayudaCorreo}</p>
        <p className="s-cierre__precio">{c.precio}</p>
      </div>
    </section>
  );
}
