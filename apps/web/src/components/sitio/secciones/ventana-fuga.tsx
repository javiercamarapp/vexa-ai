// Ventana de producto del héroe (S1): la captura real de Fuga de reembolsos (tema oscuro, datos de ejemplo) con una capa SVG propia encima.
// La capa repinta con la misma geometría las pistas y barras del ranking de SKU para que se formen por unidades, dibuja la línea de acumulado
// y la marca de 80 por ciento, y da a cada barra su tooltip por foco o cursor. Todo número sale de mocks/datos.ts; las posiciones son las medidas
// de la captura 2000 por 1250 (barras en x 873.6 a 1252.8). Sin style, sin JavaScript para verse completo: el estado inicial es el final.
import {INGRESO_BRUTO, NOMBRE_CLASE, PARETO, REEMBOLSOS, UI, acumuladoPareto, fmt, usd} from '../mocks/datos';
import type {Lang} from '../mocks/datos';
import {T} from '../mocks/datos';
import {Captura} from './captura';

const X0 = 873.6;
const ANCHO_PISTA = 379.2;
const ALTO_BARRA = 11.1;
// Borde superior de cada barra visible en la captura (las nueve primeras filas; la décima queda bajo el pliegue de la imagen).
const FILAS_Y = [603.5, 671.5, 739.6, 809.0, 877.1, 945.1, 1014.6, 1082.6, 1150.7] as const;
const MAX = PARETO[0].v;

export function VentanaFuga({lang}: {lang: Lang}) {
  const t = T(lang);
  const ui = UI(lang);
  const acum = acumuladoPareto();
  const obs = NOMBRE_CLASE.observado[lang];
  const filas = FILAS_Y.map((y, i) => ({...PARETO[i], y, w: (PARETO[i].v / MAX) * ANCHO_PISTA, cum: acum[i] / REEMBOLSOS}));
  const linea = filas.map((f, i) => `${i ? 'L' : 'M'}${(X0 + f.cum * ANCHO_PISTA).toFixed(1)} ${(f.y + ALTO_BARRA / 2).toFixed(1)}`).join('');
  const x80 = X0 + 0.8 * ANCHO_PISTA;
  return (
    <figure className="s-ventana s-ventana--producto" data-ventana="fuga">
      <div className="s-ventana__barra s-mock-barra">
        <span className="s-mock-puntos" aria-hidden="true"><span /><span /><span /></span>
        <span className="s-mock-ruta">{ui.rutas.m2}</span>
        <span className="s-mock-org">{t.organizacion}</span>
      </div>
      <p className="s-ov-cifra">
          <span className="s-ov-cifra__linea">
            <span className="s-solo-lector">{`${fmt(REEMBOLSOS)} USD ${ui.captura.devueltos}. `}</span>
            <span className="s-ov-cifra__n" data-cuenta={REEMBOLSOS} aria-hidden="true">{fmt(REEMBOLSOS)}</span>
            <span aria-hidden="true"> USD {ui.captura.devueltos}</span>
          </span>
          <span className="s-ov-cifra__sub">{`${fmt(INGRESO_BRUTO)} USD ${ui.captura.ingreso}`}</span>
          <span className="s-sello s-sello--observado s-ov-cifra__sello"><span className="s-sello__icono" aria-hidden="true" />{obs}</span>
      </p>
      <div className="s-ventana__cuerpo">
        <div className="s-ventana__lienzo">
        <Captura nombre="fuga" tema="oscuro" lang={lang} tamanos="(max-width: 700px) 170vw, (max-width: 1100px) 100vw, 1040px" anchos={[960, 1440, 2880]} prioridad clase="s-ventana__img" />
        <svg className="s-ov" viewBox="0 0 2000 1250" preserveAspectRatio="none" role="group" aria-label={ui.captura.barras} focusable="false">
          {filas.map((f, i) => (
            <g className="s-ov__fila" key={f.sku} data-i={i} tabIndex={0} role="img" aria-label={`${f.sku}, ${usd(f.v)}, ${obs}`}>
              <rect className="s-ov__zona" x={402} y={f.y - 30} width={1002} height={62} />
              <rect className="s-ov__pista" x={X0} y={f.y} width={ANCHO_PISTA} height={ALTO_BARRA} rx={ALTO_BARRA / 2} />
              <rect className="s-ov__barra" x={X0} y={f.y} width={f.w} height={ALTO_BARRA} rx={ALTO_BARRA / 2} />
              <g className="s-ov__tip" aria-hidden="true">
                <rect x={X0 + 8} y={f.y - 70} width={470} height={46} rx={9} />
                <text x={X0 + 26} y={f.y - 40}>{`${f.sku} · ${usd(f.v)} · ${obs.toUpperCase()}`}</text>
              </g>
            </g>
          ))}
          <g aria-hidden="true">
            <line className="s-ov__marca" x1={x80} x2={x80} y1={582} y2={1188} />
            <text className="s-ov__eje" x={x80 + 10} y={576}>{ui.captura.ejeMarca}</text>
            <path className="s-ov__acum" d={linea} pathLength={1} />
            {filas.map((f) => <circle className="s-ov__nodo" key={f.sku} cx={X0 + f.cum * ANCHO_PISTA} cy={f.y + ALTO_BARRA / 2} r={4.5} />)}
          </g>
        </svg>
        </div>
      </div>
      <p className="s-rotulo-ejemplo s-ventana__rotulo">{lang === 'en' ? `${t.rotulo} ${ui.captura.enEs}` : t.rotulo}</p>
    </figure>
  );
}
