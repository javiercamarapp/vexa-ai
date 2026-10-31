// Visual propio de cada uno de los cuatro pasos (S5): un recorte de la captura real del producto en tema oscuro, con una capa SVG de anotaciones
// que enseña el verbo del paso. La capa usa las mismas unidades que el recorte (unidades de 2000 por 1250 de la captura completa). Todo número
// sale de mocks/datos.ts. Sin style: la animación de cada anotación (.s-pv__a) la dispara .s-visto del paso desde el CSS.
import {EXPOSICION_SUBTOTAL, NOMBRE_CLASE, PROBLEMAS, REEMBOLSOS, UI, usd} from '../mocks/datos';
import type {Lang} from '../mocks/datos';
import {T} from '../mocks/datos';
import {medidas} from '../../../lib/sitio/activos';
import {Captura} from './captura';

type Props = {n: 1 | 2 | 3 | 4; lang: Lang};
// Unidades del lienzo de cada paso (el recorte y la capa SVG comparten sistema; la posición del recorte la fija el CSS por data-n).
const LIENZO = {1: [755, 450], 2: [1020, 430], 3: [1160, 425], 4: [505, 425]} as const;

export function VentanaPaso({n, lang}: Props) {
  const ui = UI(lang).captura;
  const t = T(lang);
  const [W, H] = LIENZO[n];
  const clave = `img/producto/paso${n}`;
  return (
    <figure className="s-ventana s-ventana--producto s-ventana--paso" data-paso-ventana={n}>
      <div className="s-ventana__barra s-mock-barra">
        <span className="s-mock-puntos" aria-hidden="true"><span /><span /><span /></span>
        <span className="s-mock-ruta">{UI(lang).rutas[n === 2 || n === 3 ? 'm3' : n === 1 ? 'm6' : 'm5']}</span>
        <span className="s-mock-org">{t.organizacion}</span>
      </div>
      <div className="s-ventana__cuerpo s-pv" data-n={n} {...(n === 2 || n === 3 ? {tabIndex: 0, role: 'group', 'aria-label': lang === 'es' ? 'Vista de la pantalla, se desplaza a los lados' : 'Screen view, scrolls sideways'} : {})}>
        <div className="s-pv__lienzo">
          <div className="s-pv__marco" data-n={n}>
            <Captura nombre={`paso${n}`} clave={clave} lang={lang} tamanos="(max-width: 1100px) 100vw, 640px" anchos={[medidas(clave).ancho]} clase="s-ventana__img" />
          </div>
          <svg className="s-pv__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
            {n === 1 ? <Paso1 u={ui.paso1} /> : null}
            {n === 2 ? <Paso2 u={ui.paso2} /> : null}
            {n === 3 ? <Paso3 u={ui.paso3} lang={lang} /> : null}
            {n === 4 ? <Paso4 u={ui.paso4} /> : null}
          </svg>
        </div>
      </div>
      <p className="s-rotulo-ejemplo s-ventana__rotulo s-ventana__rotulo--paso">{t.rotulo}</p>
    </figure>
  );
}

// Cuatro filas de fuentes: la primera es la conexión real; las otras tres, exportes que se cargan a mano. Cada registro lleva fuente y corte.
function Paso1({u}: {u: Record<string, string>}) {
  const filas = [104, 198, 291, 386];
  const rotulos = [u.hubspot, u.exporte, u.exporte, u.csv];
  const nota = [u.real, u.aMano, '', ''];
  return (
    <g>
      {filas.map((y, i) => (
        <g className="s-pv__a s-pv__a--izq" data-i={i} key={i}>
          <line className={i === 0 ? 's-pv__hebra' : 's-pv__hebra s-pv__hebra--punteada'} x1={8} x2={186} y1={y} y2={y} />
          <text className="s-pv__mono" x={8} y={y - 14}>{rotulos[i]}</text>
          <g className="s-pv__chip">
            <rect x={8} y={y + 6} width={150} height={32} rx={7} />
            <text x={19} y={y + 27}>{u.corte.charAt(0).toUpperCase() + u.corte.slice(1)}</text>
          </g>
          {nota[i] ? <text className="s-pv__mono s-pv__nota" x={8} y={y + 58}>{nota[i]}</text> : null}
        </g>
      ))}
    </g>
  );
}

// Seis conversaciones sueltas con el correo enmascarado se alinean y quedan bajo un solo encabezado de problema.
function Paso2({u}: {u: Record<string, string>}) {
  return (
    <g>
      <text className="s-pv__mono s-pv__a" data-i={0} x={40} y={24}>{u.sueltas}</text>
      {Array.from({length: 6}, (_, i) => (
        <g className="s-pv__a s-pv__suelta" data-i={i} key={i}>
          <rect x={40 + i * 150} y={42} width={132} height={32} rx={16} />
          <text x={58 + i * 150} y={63}>{u.correo}</text>
        </g>
      ))}
      <path className="s-pv__a s-pv__llave" data-i={7} d="M40 88V96H922V88" />
      <text className="s-pv__mono s-pv__a" data-i={8} x={40} y={114}>{u.agrupadas}</text>
      <text className="s-pv__cifra s-pv__a" data-i={8} x={922} y={114} textAnchor="end">{PROBLEMAS[0].casos}</text>
    </g>
  );
}

// Dos ramas que no se unen ni se suman: lo observado en continuo, la exposición inferida punteada y con su cota de ingeniería.
function Paso3({u, lang}: {u: Record<string, string>; lang: Lang}) {
  const obs = NOMBRE_CLASE.observado[lang];
  const inf = NOMBRE_CLASE.inferido[lang];
  const L = 760;
  return (
    <g>
      <g className="s-pv__a" data-i={0}>
        <line className="s-pv__cota" x1={40} x2={40 + L} y1={262} y2={262} />
        <line className="s-pv__cota" x1={40} x2={40} y1={252} y2={272} />
        <line className="s-pv__cota" x1={40 + L} x2={40 + L} y1={252} y2={272} />
        <text className="s-pv__mono s-pv__mono--cota" x={40 + L / 2} y={250} textAnchor="middle">{u.cota}</text>
      </g>
      <g className="s-pv__a s-pv__a--izq" data-i={2}>
        <line className="s-pv__rama" x1={40} x2={40 + L} y1={310} y2={310} />
        <text className="s-pv__mono" x={40} y={298}>{obs.toUpperCase()}</text>
        <text className="s-pv__cifra" x={40 + L + 20} y={316}>{usd(REEMBOLSOS)}</text>
      </g>
      <g className="s-pv__a s-pv__a--izq" data-i={4}>
        <line className="s-pv__rama s-pv__rama--punteada" x1={40} x2={40 + (L * EXPOSICION_SUBTOTAL) / REEMBOLSOS} y1={370} y2={370} />
        <text className="s-pv__mono" x={40} y={358}>{`${inf.toUpperCase()} · ${u.subtotal.toUpperCase()}`}</text>
        <text className="s-pv__cifra" x={40 + (L * EXPOSICION_SUBTOTAL) / REEMBOLSOS + 20} y={376}>{usd(EXPOSICION_SUBTOTAL)}</text>
      </g>
      <text className="s-pv__mono s-pv__a" data-i={6} x={1120} y={402} textAnchor="end">{u.nunca.toUpperCase()}</text>
    </g>
  );
}

// La acción se prepara, no se envía: queda el registro pendiente de revisión por una persona.
function Paso4({u}: {u: Record<string, string>}) {
  return (
    <g>
      <rect className="s-pv__a s-pv__foco" data-i={1} x={21} y={246} width={216} height={52} rx={12} />
      <g className="s-pv__a" data-i={4}>
        <rect className="s-pv__fila" x={0} y={340} width={505} height={64} rx={12} />
        <circle className="s-pv__ok" cx={30} cy={372} r={9} />
        <path className="s-pv__tilde" d="M25 372l4 4 7-8" />
        <text className="s-pv__txt" x={52} y={377}>{u.registro}</text>
      </g>
    </g>
  );
}
