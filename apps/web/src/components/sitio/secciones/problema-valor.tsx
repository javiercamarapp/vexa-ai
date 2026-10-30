// S3 El problema (claro) y S4 Valor y sellos (claro alterno).
import {Diagrama} from '../diagramas';
import type {IdDiagrama} from '../diagramas';
import {enlaceInterno, partesSello, sinPuntoFinal} from './datos';
import type {Lang, TextosPortada} from './datos';
import {medidas} from '../../../lib/sitio/activos';
import {VentanaCaptura} from './captura';
import {CLASES_SELLO, Palabras, Sello} from './piezas';

const DIAGRAMAS_PROBLEMA: readonly IdDiagrama[] = ['problema-1', 'problema-2', 'problema-3', 'problema-4'];

export function Problema({lang, t}: {lang: Lang; t: TextosPortada}) {
  const p = t.problema;
  return (
    <section className="s-seccion" id="problema" data-seccion="problema" data-tema="oscuro" aria-labelledby="problema-titulo">
      <div className="s-contenedor">
        <div className="s-problema__cabeza">
          <p className="s-eyebrow" data-reveal="">{p.etiqueta}</p>
          <h2 className="s-h2-grande s-problema__titulo s-centrado" id="problema-titulo" data-palabras="">
            <Palabras texto={p.titulo} clave={p.resaltada} />
          </h2>
          <p className="s-apoyo" data-reveal="">{p.apoyo}</p>
        </div>
        <div className="s-columnas" data-reveal-grupo="">
          {p.columnas.map((c, i) => (
            <div className="s-columna" data-reveal="" key={c.n}>
              <div className="s-columna__diagrama"><Diagrama id={DIAGRAMAS_PROBLEMA[i]} lang={lang} /></div>
              <span className="s-numeral" aria-hidden="true">{c.n}</span>
              <h3 className="s-columna__titulo">{c.t}</h3>
              <p className="s-columna__texto">{c.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Valor({lang, t}: {lang: Lang; t: TextosPortada}) {
  const {valor, clases} = t;
  // El sello expandido de la cifra Ingreso bruto: clase, fuente, corte y antigüedad, con los rótulos de clases.campos.
  const partes = partesSello(clases.items[0].sello);
  const enlace = enlaceInterno(clases.href);
  return (
    <section className="s-seccion" id="valor" data-seccion="valor" data-tema="oscuro" aria-labelledby="valor-titulo">
      <div className="s-contenedor">
        <div className="s-seccion__cabeza">
          <p className="s-eyebrow" data-reveal="">{valor.etiqueta}</p>
          <h2 className="s-h2-grande s-ancho-titular" id="valor-titulo">{valor.titulo}</h2>
        </div>
        <div className="s-valor__escena" data-reveal="">
          <div className="s-valor__ventana">
            <VentanaCaptura nombre="valor" clave="img/producto/valor" lang={lang} ruta="m1" tamanos="(max-width: 760px) 100vw, 780px" anchos={[medidas('img/producto/valor').ancho]} />
          </div>
          <div className="s-valor__pie">
            <span className="s-cota s-valor__cota" role="img" aria-label={valor.cotaAlt} data-cota-para="ingreso-bruto" />
            <div className="s-valor__sello s-sello-expandido" data-sello-de="ingreso-bruto">
              <b>{clases.items[0].nombre}</b>
              {partes
                ? partes.map((x, i) => <span key={i}>{clases.campos[i]}: {x}</span>)
                : <span>{sinPuntoFinal(clases.items[0].sello)}</span>}
            </div>
          </div>
        </div>
        <div className="s-sellos" data-reveal-grupo="">
          {clases.items.map((c, i) => (
            <div className="s-sello-def" data-reveal="" key={c.nombre}>
              <Sello clase={CLASES_SELLO[i]}>{c.nombre}</Sello>
              <p className="s-sello-def__texto">{c.d}</p>
            </div>
          ))}
        </div>
        <p className="s-eyebrow s-centrado s-mt-80">{clases.reglaEtiqueta}</p>
        <p className="s-h3-serif s-valor__regla">{clases.regla}</p>
        {enlace && clases.enlace ? <p className="s-centrado s-mt-32"><a className="s-enlace-flecha" href={enlace}><span>{clases.enlace}</span></a></p> : null}
      </div>
    </section>
  );
}
