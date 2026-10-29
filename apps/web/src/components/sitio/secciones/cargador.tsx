// Cargador (T8): overlay en el HTML con el logo real (anillo por máscara, punto rojo y palabra) y el control Saltar animación.
// Sin JavaScript o con movimiento reducido el CSS de T6 no lo pinta. El anillo del kit es una forma rellena, así que se revela con una
// máscara cuyo trazo recorre la circunferencia desde las 12 en sentido horario (pathLength 214, el dasharray de T6).
import {LOGOS_SITIO} from '../shell/logo-datos';
import type {TextosPortada} from './datos';

const KIT = LOGOS_SITIO.horizontal;
const [ANILLO, PALABRA] = KIT.tinta;

// Centro y radios del anillo, calculados de sus propios puntos (no a mano): la máscara cubre de punta a punta.
const PUNTOS = [...ANILLO.matchAll(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
const XS = PUNTOS.map((p) => p[0]);
const YS = PUNTOS.map((p) => p[1]);
const CX = (Math.min(...XS) + Math.max(...XS)) / 2;
const CY = (Math.min(...YS) + Math.max(...YS)) / 2;
const RADIOS = PUNTOS.map(([x, y]) => Math.hypot(x - CX, y - CY));
const R_MIN = Math.min(...RADIOS);
const R_MAX = Math.max(...RADIOS);
const R_MEDIO = (R_MIN + R_MAX) / 2;
const GROSOR = R_MAX - R_MIN + 12;

export function Cargador({t}: {t: TextosPortada['carga']}) {
  return (
    <div className="s-cargador" role="group" aria-label={t.etiqueta} data-cargador="">
      <svg className="s-cargador__logo" viewBox={KIT.viewBox} aria-hidden="true" focusable="false">
        <defs>
          <mask id="s-carga-mascara" maskUnits="userSpaceOnUse" x={CX - R_MAX - 6} y={CY - R_MAX - 6} width={2 * R_MAX + 12} height={2 * R_MAX + 12}>
            <circle className="s-cargador__mascara" cx={CX} cy={CY} r={R_MEDIO} strokeWidth={GROSOR} pathLength={214} transform={`rotate(-90 ${CX} ${CY})`} />
          </mask>
        </defs>
        <path d={ANILLO} fill="currentColor" mask="url(#s-carga-mascara)" />
        <circle className="s-cargador__punto" cx={KIT.punto.cx} cy={KIT.punto.cy} r={KIT.punto.r} />
        <path className="s-cargador__palabra" d={PALABRA} />
      </svg>
      <button className="s-cargador__saltar" type="button" data-saltar-cargador="">{t.omitir}</button>
    </div>
  );
}
