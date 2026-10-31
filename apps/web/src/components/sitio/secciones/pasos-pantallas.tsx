// S5 Cuatro pasos (escena fija, oscuro) y S6 Seis pantallas (claro).
// S5: sin JavaScript, en movimiento reducido y en móvil los cuatro pasos quedan apilados, cada uno con su visual propio y su texto.
// Con JavaScript en escritorio ancho el CSS fija la pista y muestra el paso activo (data-paso). El visual de cada paso es un recorte de la captura
// real del producto con una capa SVG que enseña el verbo del paso (ventana-paso.tsx); la anima .s-visto del paso.
import {Captura} from './captura';
import {medidas} from '../../../lib/sitio/activos';
import {UI} from '../mocks/datos';
import {enlaceInterno} from './datos';
import type {Lang, TextosPortada} from './datos';
import {dosCifras} from './piezas';
import {VentanaPaso} from './ventana-paso';

export function Pasos({lang, t}: {lang: Lang; t: TextosPortada}) {
  const m = t.modulos;
  return (
    <section className="s-seccion s-escena" id="modulos" data-seccion="pasos" data-tema="oscuro" data-escena="" data-paso="0" aria-labelledby="modulos-titulo">
      <div className="s-escena__pista">
        <div className="s-contenedor s-escena__fijo">
          <h2 className="s-solo-lector" id="modulos-titulo">{m.titulo}</h2>
          <p className="s-solo-lector">{m.apoyo}</p>
          {m.items.map((it, i) => (
            <article className="s-paso" data-n={i + 1} data-visto="" aria-labelledby={`paso-${i + 1}-titulo`} key={it.nombre}>
              <div className="s-paso__texto">
                <span className="s-paso__etiqueta">{m.contador[i]}</span>
                <h3 className="s-h2" id={`paso-${i + 1}-titulo`}>{it.titulo}</h3>
                <p className="s-lead">{it.texto}</p>
                {it.limite ? <p className="s-paso__limite">{it.limite}</p> : null}
              </div>
              <div className="s-paso__visual">
                <VentanaPaso n={(i + 1) as 1 | 2 | 3 | 4} lang={lang} />
              </div>
            </article>
          ))}
          <div className="s-progreso s-escena__progreso" aria-hidden="true">
            {m.items.map((it) => (
              <span className="s-progreso__seg" key={it.nombre}><span className="s-escena__cabeza" /></span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// Pantalla real de cada tarjeta (tema claro, la sección es clara). La quinta, sin captura propia, usa la tarjeta de siguiente acción de Hoy.
const CAPTURA_PANTALLA = ['hoy', 'fuga', 'problemas', 'preguntale', 'pantalla5', 'conexiones'] as const;

export function Pantallas({lang, t}: {lang: Lang; t: TextosPortada}) {
  const p = t.pantallas;
  const todas = enlaceInterno(p.hrefTodas);
  const rotulo = UI(lang).captura.ejemplo;
  return (
    <section className="s-seccion" id="pantallas" data-seccion="pantallas" data-tema="claro" aria-labelledby="pantallas-titulo">
      <div className="s-contenedor">
        <div className="s-seccion__cabeza">
          <p className="s-eyebrow" data-reveal="">{p.etiqueta}</p>
          <h2 className="s-h2 s-ancho-titular" id="pantallas-titulo">{p.titulo}</h2>
          <p className="s-lead s-apagado">{p.apoyo}</p>
        </div>
        {/* T16: carrusel de scroll-snap. Escritorio: una pantalla grande a todo el ancho con selector de las seis; móvil: tarjetas de 86 por ciento que
            se recorren con el dedo. Sin JavaScript sigue siendo un carrusel desplazable por teclado (la región es enfocable). */}
        <div className="s-pantallas__selector" role="group" aria-label={p.titulo} data-pantallas-selector="">
          {p.items.map((it, i) => (
            <button className="s-pantallas__boton" type="button" data-pantalla-sel={i} aria-current={i === 0 ? 'true' : undefined} key={it.t}>
              <span className="s-mono-min">{dosCifras(i + 1)}</span>
              <span className="s-pantallas__boton-t">{it.t}</span>
            </button>
          ))}
        </div>
        <div className="s-pantallas" role="region" aria-roledescription="carrusel" aria-label={p.etiqueta} tabIndex={0} data-pantallas="">
          {p.items.map((it, i) => {
            const href = enlaceInterno(it.href);
            const clave = CAPTURA_PANTALLA[i];
            return (
              <div className={`s-pantalla s-tarjeta${href ? ' s-tarjeta--capacidad' : ''}`} role="group" aria-roledescription="diapositiva" aria-label={`${i + 1} / ${p.items.length}`} data-pantalla={i} key={it.t}>
                <div className="s-pantalla__miniatura" data-n={i + 1}>
                  <Captura nombre={clave} clave={clave === 'pantalla5' ? 'img/producto/pantalla5' : undefined} tema="claro" lang={lang} tamanos="(max-width: 768px) 300vw, 1152px" clase="s-pantalla__img" anchos={clave === 'pantalla5' ? [medidas('img/producto/pantalla5').ancho] : [960, 1440]} />
                  <span className="s-pantalla__barrido" aria-hidden="true" />
                </div>
                <div className="s-pantalla__cuerpo">
                  <span className="s-mono-min">{dosCifras(i + 1)}</span>
                  <h3 className="s-pantalla__titulo" id={`pantalla-${i + 1}-titulo`}>
                    {/* Enlace estirado: el nombre accesible es exactamente el texto visible del enlace */}
                    {href ? <a className="s-pantalla__enlace" href={href}>{it.t}</a> : it.t}
                  </h3>
                  <p className="s-pantalla__pregunta">{it.pregunta}</p>
                  <span className="s-pantalla__ejemplo">{rotulo}</span>
                  {href ? <span className="s-pantalla__flecha" aria-hidden="true"><span className="s-flecha" /></span> : null}
                </div>
              </div>
            );
          })}
        </div>
        {todas ? <p className="s-mt-48"><a className="s-enlace-flecha" href={todas}><span>{p.enlaceTodas}</span></a></p> : null}
      </div>
    </section>
  );
}
