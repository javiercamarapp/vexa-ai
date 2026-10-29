// S7 Por puesto (claro alterno): arco con cuatro orbes (objetos o1 a o4 sobre disco oscuro), cápsula central, pestañas y el texto de cada puesto.
// Sin JavaScript los cuatro textos quedan visibles y apilados (no hay `hidden` en el HTML); sitio.js marca el puesto activo con data-puesto y
// oculta con el atributo hidden los otros. Después, el bloque de Finanzas y Experiencia del cliente.
import {alt, medidas, url} from '../../../lib/sitio/activos';
import {enlaceInterno} from './datos';
import type {Lang, TextosPortada} from './datos';

export function Puestos({lang, t}: {lang: Lang; t: TextosPortada}) {
  const p = t.puestos;
  const l = p.lideres;
  const hrefFin = enlaceInterno(l.finanzas.href);
  const hrefCx = enlaceInterno(l.cx.href);
  return (
    <section className="s-seccion s-seccion--alterna s-seccion--corte" id="puestos" data-seccion="puestos" data-tema="claro" data-puesto="1" aria-labelledby="puestos-titulo">
      <div className="s-contenedor">
        <div className="s-seccion__cabeza">
          <p className="s-eyebrow" data-reveal="">{p.etiqueta}</p>
          <h2 className="s-h2 s-ancho-titular" id="puestos-titulo">{p.titulo}</h2>
        </div>
        <div className="s-puestos__arco" aria-hidden="true" data-reveal="">
          <div className="s-arco"><div className="s-arco__giro" /></div>
          {[1, 2, 3, 4].map((n) => {
            const clave = `img/o${n}-orbe`;
            const {ancho, alto} = medidas(clave);
            return (
              <span className={`s-orbe s-orbe--${n}`} key={n}>
                <img src={url(clave)} srcSet={`${url(clave, {ancho: 96})} 96w, ${url(clave)} ${ancho}w`} sizes="90px" width={ancho} height={alto} alt={alt(clave, lang)} loading="lazy" decoding="async" />
              </span>
            );
          })}
          <div className="s-capsula"><span className="s-capsula__nombre">{p.items[0].t}</span></div>
        </div>
        <div className="s-pestanas" role="tablist" aria-label={p.titulo}>
          {p.items.map((it, i) => (
            <button className="s-pestana" type="button" role="tab" id={`puesto-pestana-${i + 1}`} aria-selected={i === 0} aria-controls={`puesto-panel-${i + 1}`} data-puesto-n={i + 1} key={it.t}>{it.t}</button>
          ))}
        </div>
        {p.items.map((it, i) => {
          const href = enlaceInterno(it.href);
          return (
            <div className="s-puestos__texto" role="tabpanel" id={`puesto-panel-${i + 1}`} aria-labelledby={`puesto-pestana-${i + 1}`} data-puesto-panel={i + 1} key={it.t}>
              <h3 className="s-h3-producto">{it.t}</h3>
              <p>{it.d}</p>
              <p className="s-mt-8">{it.ve}</p>
              {href ? <p className="s-mt-16"><a className="s-enlace-flecha" href={href}><span>{p.enlaceItem}</span></a></p> : null}
            </div>
          );
        })}
        <p className="s-puestos__cierre s-h3-serif">{p.cierre}</p>
        <div className="s-mt-96">
          <h3 className="s-h3-serif s-centrado s-lectura s-mb-48">{l.titulo}</h3>
          <div className="s-tarjetas-ficha">
            <div className="s-tarjeta s-tarjeta--capacidad">
              <h4 className="s-h3-producto">{l.finanzas.t}</h4>
              {l.finanzas.d ? <p className="s-mt-16 s-apagado">{l.finanzas.d}</p> : null}
              {hrefFin ? <p className="s-mt-16"><a className="s-enlace-flecha" href={hrefFin}><span>{p.enlaceItem}</span></a></p> : null}
            </div>
            <div className="s-tarjeta s-tarjeta--capacidad">
              <h4 className="s-h3-producto">{l.cx.t}</h4>
              {l.cx.d ? <p className="s-mt-16 s-apagado">{l.cx.d}</p> : null}
              {l.cx.salvedad ? <p className="s-mt-16 s-mono-min">{l.cx.salvedad}</p> : null}
              {hrefCx ? <p className="s-mt-16"><a className="s-enlace-flecha" href={hrefCx}><span>{p.enlaceItem}</span></a></p> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
