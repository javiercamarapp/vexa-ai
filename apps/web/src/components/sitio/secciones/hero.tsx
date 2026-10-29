// S1 Hero y reglas (sobre #0E0E10) y S2 Horizonte. El titular va en dos líneas; subtítulo y línea de ingreso bruto y exposición inferida
// van pegados a él (hojas MATIZ con adyacencia: si publicar() omite alguna, no se pinta el titular blindado sino la reserva).
// El póster del héroe es el candidato a LCP: fetchpriority alta y ancho y alto del manifest; React 19 sube a <head> su precarga (link preload
// con imagesrcset e imagesizes) por llevar fetchPriority alta. El canvas lo toma nube.js en modo halo.
import {Fragment} from 'react';
import {url} from '../../../lib/sitio/activos';
import {Boton, ImagenManifest, dosCifras} from './piezas';
import {enDosLineas} from './datos';
import type {Lang, TextosPortada} from './datos';

const TAMANOS_HERO = '(max-width: 768px) 92vw, 760px';

export function Hero({lang, t}: {lang: Lang; t: TextosPortada}) {
  const {hero, puente} = t;
  // El titular blindado solo sale con su subtítulo y su línea de límite; si falta cualquiera, la reserva va sola.
  const blindado = Boolean(hero.titulo && hero.subtitulo && hero.limite);
  const titulo = blindado ? (hero.titulo as string) : hero.titularReserva;
  const lineas = enDosLineas(titulo);
  return (
    <section className="s-hero" id="inicio" data-seccion="hero" data-tema="oscuro" aria-labelledby="inicio-titulo">
      <div className="s-hero__pista">
        <div className="s-hero__escena">
          <div className="s-hero__objeto" aria-hidden="true">
            <canvas className="s-nube" data-nube="hero" data-modo="halo" data-estado="cargando" data-pts={url('pts/hero')} />
            <ImagenManifest clave="img/hero" lang={lang} clase="s-poster" tamanos={TAMANOS_HERO} prioridad />
          </div>
          <div className="s-hero__contenido">
            <p className="s-eyebrow">{hero.eyebrow}</p>
            <h1 className="s-display s-hero__titulo" id="inicio-titulo">
              {lineas.map((l, i) => (
                <Fragment key={i}>
                  {i > 0 ? ' ' : null}
                  <span className="s-hero__linea"><span>{l}</span></span>
                </Fragment>
              ))}
            </h1>
            {blindado ? (
              <>
                <p className="s-lead s-hero__sub">{hero.subtitulo}</p>
                <p className="s-hero__limite">{hero.limite}</p>
              </>
            ) : null}
            <div className="s-hero__acciones">
              <Boton href="#cierre">{hero.cta}</Boton>
              <Boton href="#modulos" secundario>{hero.ctaSecundario}</Boton>
            </div>
            <p className="s-hero__micro">{hero.micro}</p>
          </div>
          <div className="s-hero__reglas">
            {puente.titulo ? <h2 className="s-h2 s-centrado">{puente.titulo}</h2> : null}
            <div className="s-reglas">
              {puente.reglas.map((r, i) => (
                <div className="s-regla" key={i}>
                  <span className="s-numeral" aria-hidden="true">{dosCifras(i + 1)}</span>
                  <h3 className="s-regla__titulo">{r}</h3>
                </div>
              ))}
            </div>
          </div>
          <p className="s-rotulo-ejemplo s-hero__rotulo">{hero.rotulo}</p>
          <span className="s-hero__scroll" aria-hidden="true" />
          {/* S2 Horizonte: sin contenido; sube desde el borde inferior de S1 y deja el borde superior de S3 en #F7F7F8. */}
          <div className="s-horizonte" id="horizonte" data-seccion="horizonte" data-tema="claro" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
