// Mockups M4 Pregúntale a tus datos, M5 Por decidir y M6 Confianza.
// M4 corre con reglas y herramientas de solo lectura: no lleva el rótulo IA ni simula un modelo de lenguaje. Los pasos son los del sistema.
import {CANALES, FUENTES, INGRESO_EN_JUEGO, INTENSIDAD, REEMBOLSOS, T, UI, totalCanal} from './datos';
import type {Lang} from './datos';
import {Alerta, Sello, Usd} from './piezas';
import type {Variante} from './piezas';

type Props = {lang: Lang; variante: Variante};

/** Divide una frase de T11 en sus oraciones, sin el punto final. */
const oraciones = (s: string): string[] => s.split('. ').map((x) => x.replace(/\.$/, ''));

/** M4 Pregúntale a tus datos: pregunta, respuesta con tabla por canal, sello y los pasos del cálculo. */
export function M4({lang}: Props) {
  const t = T(lang).m4;
  const ui = UI(lang);
  const orden = CANALES.map((c, i) => ({i, v: totalCanal(i)})).sort((a, b) => b.v - a.v);
  const max = orden[0].v;
  return (
    <div className="s-mock-m4">
      <div className="s-mock-principal">
        <div className="s-mock-cab">
          <p className="s-mock-titulo">{t.marco}</p>
          <span className="s-mock-etiqueta s-mock-sec">{ui.m4.reglas}</span>
        </div>
        <div className="s-mock-conversacion">
          <p className="s-mock-pregunta">{t.pregunta}</p>
          <div className="s-mock-respuesta">
            <p className="s-mock-respuesta__texto s-mock-sec">{t.respuesta}</p>
            <div className="s-mock-m4tabla">
              {orden.map(({i, v}) => (
                <div key={i} className="s-mock-m4fila" {...(v === max ? {'data-enfasis': ''} : {})}>
                  <span className="s-mock-m4fila__canal">{t.tabla[i].c}</span>
                  <span className="s-mock-m4fila__barra" aria-hidden="true">
                    <svg viewBox="0 0 100 6" preserveAspectRatio="none" focusable="false">
                      <rect className="s-mock-m4fila__fondo" x="0" y="0" width="100" height="6" />
                      <rect className="s-mock-m4fila__relleno" x="0" y="0" width={((v / max) * 100).toFixed(2)} height="6" />
                    </svg>
                  </span>
                  <span className="s-mock-valor s-mock-valor--tabla"><Usd n={v} /></span>
                </div>
              ))}
              <div className="s-mock-m4fila s-mock-m4fila--total s-mock-ter">
                <span className="s-mock-m4fila__canal">{ui.m4.total}</span>
                <span />
                <span className="s-mock-valor s-mock-valor--tabla"><Usd n={REEMBOLSOS} /></span>
              </div>
            </div>
            <div className="s-mock-m4sello">
              <Sello clase="observado" lang={lang} compacto />
              <span className="s-mock-sellopie">{oraciones(t.sello).slice(1).join('. ')}</span>
            </div>
          </div>
          <div className="s-mock-pasos s-mock-sec">
            <p className="s-mock-pasos__titulo">
              <span className="s-mock-pasos__flecha" aria-hidden="true" />
              {t.desplegable}
            </p>
            <ol className="s-mock-pasos__lista">
              {t.pasos.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
            <p className="s-mock-nota">{t.notaPasos}</p>
          </div>
          <div className="s-mock-sugerencias s-mock-ter">
            {t.sugerencias.map((s) => (
              <span key={s} className="s-mock-sugerencia">
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="s-mock-entrada s-mock-ter">
          <span>{ui.m4.entrada}</span>
          <span className="s-mock-entrada__boton" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

/** M5 Por decidir: una recomendación propuesta por regla, con su evidencia y tres decisiones. Decide una persona. */
export function M5({lang}: Props) {
  const t = T(lang).m5;
  const ui = UI(lang);
  const alto = Math.max(...INTENSIDAD.meses, INTENSIDAD.umbral);
  const [etqEnJuego] = t.enJuego.split(': ');
  return (
    <div className="s-mock-m5">
      <div className="s-mock-principal">
        <div className="s-mock-cab">
          <p className="s-mock-titulo">{t.marco}</p>
          <span className="s-mock-etiqueta s-mock-sec">{ui.m5.enCola} 1</span>
        </div>
        <div className="s-mock-m5__cuerpo">
          <div className="s-mock-tarjeta">
            <p className="s-mock-etiqueta s-mock-sec">{t.origen.replace(/\.$/, '')}</p>
            <p className="s-mock-tarjeta__titulo">{t.tarjeta}</p>
            <p className="s-mock-tarjeta__porque s-mock-ter">
              <span className="s-mock-etiqueta">{ui.m5.porQue}</span>
              {t.porQue}
            </p>
            <p className="s-mock-tarjeta__juego">
              <span className="s-mock-etiqueta">{etqEnJuego}</span>
              <span className="s-mock-valor"><Usd n={INGRESO_EN_JUEGO} /></span>
              <Sello clase="inferido" lang={lang} compacto />
            </p>
            <div className="s-mock-decisiones">
              {t.botones.map((b, i) => (
                <span key={b} className={i === 0 ? 's-mock-boton s-mock-boton--primario' : 's-mock-boton'}>
                  {b}
                </span>
              ))}
            </div>
            <p className="s-mock-nota s-mock-sec">{t.aviso}</p>
          </div>
          <div className="s-mock-evidencia s-mock-sec">
            <p className="s-mock-sub">{ui.m5.evidenciaTitulo}</p>
            <p className="s-mock-etiqueta">{ui.m5.intensidad}</p>
            <div className="s-mock-intensidad">
              <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <line className="s-mock-rejilla" x1="0" x2="100" y1="60" y2="60" />
                <line className="s-mock-referencia" x1="0" x2="100" y1={60 - (INTENSIDAD.umbral / alto) * 56} y2={60 - (INTENSIDAD.umbral / alto) * 56} />
                {INTENSIDAD.meses.map((v, i) => (
                  <rect key={i} className={i === 2 ? 's-mock-barra-pareto s-mock-barra-pareto--enfasis' : 's-mock-barra-pareto'} x={i * 33 + 5} width="22" y={60 - (v / alto) * 56} height={(v / alto) * 56} />
                ))}
              </svg>
            </div>
            <div className="s-mock-intensidad__etiquetas" aria-hidden="true">
              {INTENSIDAD.meses.map((v, i) => (
                <span key={i}>
                  <b>{v.toFixed(1)} %</b>
                  {ui.m5.meses[i]}
                </span>
              ))}
            </div>
            <p className="s-mock-leyenda">
              <span className="s-mock-leyenda__linea s-mock-leyenda__linea--punteada" aria-hidden="true" />
              {ui.m5.umbral} {INTENSIDAD.umbral.toFixed(1)} %
            </p>
            <div className="s-mock-m4sello">
              <Sello clase="observado" lang={lang} compacto />
              <span className="s-mock-sellopie">{t.evidencia}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** M6 Confianza: tres fuentes con su estado por forma y lo que todavía no se sabe. */
export function M6({lang, variante}: Props) {
  const t = T(lang).m6;
  const ui = UI(lang);
  const rojo = variante !== 'miniatura';
  const filas = t.filas.map(oraciones);
  return (
    <div className="s-mock-m6">
      <div className="s-mock-principal">
        <div className="s-mock-cab">
          <p className="s-mock-titulo">{t.marco}</p>
          <span className="s-mock-medidor">
            <span className="s-mock-medidor__segs" aria-hidden="true">
              {filas.map((_, i) => (
                <span key={i} className={FUENTES[i].estado === 'aldia' ? 's-mock-medidor__seg s-mock-medidor__seg--on' : 's-mock-medidor__seg'} />
              ))}
            </span>
            <span className="s-mock-valor s-mock-valor--medidor">{t.indicador.replace(/\.$/, '')}</span>
          </span>
        </div>
        <div className="s-mock-fuentes">
          <div className="s-mock-fuentes__cab s-mock-sec">
            <span>{ui.m6.fuente}</span>
            <span>{ui.m6.estado}</span>
          </div>
          {filas.map(([nombre, estado, detalle], i) => (
            <div key={nombre} className="s-mock-fuente">
              <span className="s-mock-fuente__icono" aria-hidden="true" data-estado={FUENTES[i].estado} />
              <p className="s-mock-fuente__nombre">{nombre}</p>
              <p className="s-mock-fuente__detalle s-mock-sec">{detalle ?? ''}</p>
              <span className="s-mock-estado" data-estado={FUENTES[i].estado}>
                <span className="s-mock-estado__forma" aria-hidden="true" />
                {estado}
              </span>
            </div>
          ))}
        </div>
        <div className="s-mock-nosabemos s-mock-ter">
          <p className="s-mock-sub">{t.noSabemosTitulo}</p>
          {t.noSabemos.map((n, i) => (
            <p key={n} className="s-mock-nosabe">
              {i === 0 ? <Alerta visible={rojo} /> : <span className="s-mock-nosabe__guion" aria-hidden="true" />}
              <span>{n}</span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
