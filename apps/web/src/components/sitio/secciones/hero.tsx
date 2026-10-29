// S1 Hero (sobre #0E0E10). El titular va en dos líneas; subtítulo y línea de ingreso bruto y exposición inferida van pegados a él
// (hojas MATIZ con adyacencia: si publicar() omite alguna, no se pinta el titular blindado sino la reserva).
// Debajo, la ventana de producto con la captura real de Fuga de reembolsos y su capa SVG (ventana-fuga.tsx), y las cuatro reglas del puente.
// El elemento LCP es el titular (texto). La captura se carga con prioridad alta pero no bloquea nada.
import {Fragment} from 'react';
import {Boton, dosCifras} from './piezas';
import {enDosLineas} from './datos';
import type {Lang, TextosPortada} from './datos';
import {VentanaFuga} from './ventana-fuga';

export function Hero({lang, t}: {lang: Lang; t: TextosPortada}) {
  const {hero, puente} = t;
  // El titular blindado solo sale con su subtítulo y su línea de límite; si falta cualquiera, la reserva va sola.
  const blindado = Boolean(hero.titulo && hero.subtitulo && hero.limite);
  const titulo = blindado ? (hero.titulo as string) : hero.titularReserva;
  const lineas = enDosLineas(titulo);
  return (
    <section className="s-hero" id="inicio" data-seccion="hero" data-tema="oscuro" aria-labelledby="inicio-titulo">
      <div className="s-hero__escena">
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
        <div className="s-hero__marco">
          <VentanaFuga lang={lang} />
        </div>
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
      {/* S2 Horizonte: un solo resplandor de 120 px al pie del héroe; no cambia el tema (eso lo hace la escena global). */}
      <div className="s-horizonte" id="horizonte" data-seccion="horizonte" aria-hidden="true" />
    </section>
  );
}
