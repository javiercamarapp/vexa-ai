// S5 Cuatro pasos (escena fija, oscuro) y S6 Seis pantallas (claro).
// S5: sin JavaScript, en movimiento reducido y en móvil los cuatro pasos quedan apilados, cada uno con su visual propio y su texto.
// Con JavaScript en escritorio ancho el CSS fija la pista y muestra el paso activo (data-paso). El visual de cada paso es un recorte de la captura
// real del producto con una capa SVG que enseña el verbo del paso (ventana-paso.tsx); la anima .s-visto del paso.
import {Captura} from './captura';
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
  return (
    <section className="s-seccion" id="pantallas" data-seccion="pantallas" data-tema="claro" aria-labelledby="pantallas-titulo">
      <div className="s-contenedor">
        <div className="s-seccion__cabeza">
          <p className="s-eyebrow" data-reveal="">{p.etiqueta}</p>
          <h2 className="s-h2 s-ancho-titular" id="pantallas-titulo">{p.titulo}</h2>
          <p className="s-lead s-apagado">{p.apoyo}</p>
        </div>
        <div className="s-pantallas" data-reveal-grupo="">
          {p.items.map((it, i) => {
            const href = enlaceInterno(it.href);
            const cuerpo = (
              <>
                <div className="s-pantalla__miniatura">
                  <Captura nombre={CAPTURA_PANTALLA[i]} clave={CAPTURA_PANTALLA[i] === 'pantalla5' ? 'img/producto/pantalla5' : undefined} tema="claro" lang={lang} tamanos="(max-width: 768px) 92vw, 352px" clase="s-pantalla__img" anchos={CAPTURA_PANTALLA[i] === 'pantalla5' ? [727] : [960, 1440]} />
                  <span className="s-pantalla__barrido" aria-hidden="true" />
                  <span className="s-pantalla__ejemplo">{UI(lang).captura.ejemplo}</span>
                </div>
                <div className="s-pantalla__cuerpo">
                  <span className="s-mono-min">{dosCifras(i + 1)}</span>
                  <h3 className="s-pantalla__titulo" id={`pantalla-${i + 1}-titulo`}>{it.t}</h3>
                  <p className="s-pantalla__pregunta">{it.pregunta}</p>
                  {href ? <span className="s-pantalla__flecha" aria-hidden="true"><span className="s-flecha" /></span> : null}
                </div>
              </>
            );
            // Solo se enlaza lo que el registro publica; el resto es una tarjeta sin enlace ni resalte de capacidad.
            return href ? (
              <a className="s-pantalla s-tarjeta s-tarjeta--capacidad" href={href} data-reveal="" aria-labelledby={`pantalla-${i + 1}-titulo`} key={it.t}>{cuerpo}</a>
            ) : (
              <div className="s-pantalla s-tarjeta" data-reveal="" key={it.t}>{cuerpo}</div>
            );
          })}
        </div>
        {todas ? <p className="s-mt-48"><a className="s-enlace-flecha" href={todas}><span>{p.enlaceTodas}</span></a></p> : null}
      </div>
    </section>
  );
}
