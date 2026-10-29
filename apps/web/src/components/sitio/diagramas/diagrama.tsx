// Diagramas de red de línea fina (T9). SVG de servidor con nodos de 6 px, nodo central de 14, línea de 1 px, rótulos mono de 11 px, esquinas
// de visor en L y un pulso opcional. Sin style, con currentColor y variables en el CSS, accesibles con title y desc. Un solo rojo por diagrama
// como máximo: la marca de corte del problema 2. Las clases s-red__* son las de T6; las s-diag-* están en mocks.css.
import type {ReactNode} from 'react';
import {IDS_DIAGRAMA, rotulo, textosIntegraciones, textosProblema, textosProcedencia, textosSeguridad} from './datos';
import type {IdDiagrama, Lang} from './datos';

type P = {lang: Lang};

const Nodo = ({x, y, tipo = ''}: {x: number; y: number; tipo?: '' | 'central' | 'lleno'}) => (
  <circle className={`s-red__nodo${tipo ? ` s-red__nodo--${tipo}` : ''}`} cx={x} cy={y} r={tipo === 'central' ? 7 : 3} />
);
const Linea = ({x1, y1, x2, y2, f = ''}: {x1: number; y1: number; x2: number; y2: number; f?: '' | 'tenue' | 'punteada' | 'ambas'}) => (
  <line className={`s-red__linea${f === 'tenue' || f === 'ambas' ? ' s-red__linea--tenue' : ''}${f === 'punteada' || f === 'ambas' ? ' s-red__linea--punteada' : ''}`} x1={x1} y1={y1} x2={x2} y2={y2} />
);
const Pulso = ({x1, y1, x2, y2}: {x1: number; y1: number; x2: number; y2: number}) => <line className="s-red__pulso" x1={x1} y1={y1} x2={x2} y2={y2} />;
const Texto = ({x, y, children, ancla = 'middle', clase = 's-diag-rotulo'}: {x: number; y: number; children: ReactNode; ancla?: 'start' | 'middle' | 'end'; clase?: string}) => (
  <text className={clase} x={x} y={y} textAnchor={ancla}>
    {children}
  </text>
);
/** Cuatro esquinas de visor en L de 12 por 1.5 alrededor de una caja. */
const Visor = ({x, y, w, h, l = 12}: {x: number; y: number; w: number; h: number; l?: number}) => (
  <path className="s-diag-visor" d={`M${x} ${y + l}V${y}H${x + l} M${x + w - l} ${y}H${x + w}V${y + l} M${x + w} ${y + h - l}V${y + h}H${x + w - l} M${x + l} ${y + h}H${x}V${y + h - l}`} />
);

/** Grupo con un nodo central y satélites a 45 grados. Devuelve spokes, anillo interior y pulsos. */
function Grupo({cx, cy, r, pulsos = [0]}: {cx: number; cy: number; r: number; pulsos?: number[]}) {
  const k = r * Math.SQRT1_2;
  const sat: [number, number][] = [[cx - k, cy - k], [cx + k, cy - k], [cx + k, cy + k], [cx - k, cy + k]];
  return (
    <g>
      {sat.map(([x, y], i) => (
        <Linea key={`a${i}`} x1={cx} y1={cy} x2={x} y2={y} />
      ))}
      {sat.map(([x, y], i) => {
        const [x2, y2] = sat[(i + 1) % 4];
        return <Linea key={`b${i}`} x1={x} y1={y} x2={x2} y2={y2} f="tenue" />;
      })}
      {pulsos.map((i) => (
        <Pulso key={`p${i}`} x1={cx} y1={cy} x2={sat[i][0]} y2={sat[i][1]} />
      ))}
      {sat.map(([x, y], i) => (
        <Nodo key={`n${i}`} x={x} y={y} />
      ))}
      <Nodo x={cx} y={cy} tipo="central" />
    </g>
  );
}

function Envoltura({id, ancho, alto, titulo, desc, children, extra = ''}: {id: string; ancho: number; alto: number; titulo: string; desc: string; children: ReactNode; extra?: string}) {
  return (
    <svg className={`s-red s-diag${extra ? ` ${extra}` : ''}`} viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-labelledby={`s-diag-${id}-t s-diag-${id}-d`} data-diagrama={id.replace(/-(n|a)$/, '')}>
      <title id={`s-diag-${id}-t`}>{titulo}</title>
      <desc id={`s-diag-${id}-d`}>{desc}</desc>
      {children}
    </svg>
  );
}

// ---------- Problema, cuatro columnas de 244 por 160 ----------
function Problema1({lang}: P) {
  const t = textosProblema(lang).columnas[0];
  const grupos: [number, number, string][] = [[42, 62, rotulo('soporte', lang)], [122, 86, rotulo('pedidos', lang)], [202, 62, rotulo('hojas', lang)]];
  return (
    <Envoltura id="problema-1" ancho={244} alto={160} titulo={t.t} desc={t.alt}>
      <Linea x1={82} y1={28} x2={82} y2={132} f="punteada" />
      <Linea x1={162} y1={28} x2={162} y2={132} f="punteada" />
      {grupos.map(([x, y, n]) => (
        <g key={n}>
          <Linea x1={x - 16} y1={y - 14} x2={x + 16} y2={y - 14} />
          <Linea x1={x - 16} y1={y - 14} x2={x} y2={y + 14} />
          <Linea x1={x + 16} y1={y - 14} x2={x} y2={y + 14} />
          <Nodo x={x - 16} y={y - 14} />
          <Nodo x={x + 16} y={y - 14} />
          <Nodo x={x} y={y + 14} tipo="central" />
          <Texto x={x} y={y + 46}>{n}</Texto>
        </g>
      ))}
    </Envoltura>
  );
}

function Problema2({lang}: P) {
  const t = textosProblema(lang).columnas[1];
  return (
    <Envoltura id="problema-2" ancho={244} alto={160} titulo={t.t} desc={t.alt}>
      <Linea x1={30} y1={64} x2={80} y2={64} />
      <Linea x1={80} y1={64} x2={112} y2={64} />
      <Linea x1={132} y1={64} x2={164} y2={64} />
      <Linea x1={164} y1={64} x2={214} y2={64} />
      <Linea x1={80} y1={64} x2={122} y2={108} f="tenue" />
      <Linea x1={164} y1={64} x2={122} y2={108} f="tenue" />
      <path className="s-red__marca" d="M119.5 61.5l5 5M124.5 61.5l-5 5" />
      {[30, 80, 164, 214].map((x) => (
        <Nodo key={x} x={x} y={64} />
      ))}
      <Nodo x={122} y={108} tipo="central" />
      <Texto x={122} y={38}>{rotulo('fuga', lang)}</Texto>
    </Envoltura>
  );
}

function Problema3({lang}: P) {
  const t = textosProblema(lang).columnas[2];
  return (
    <Envoltura id="problema-3" ancho={244} alto={160} titulo={t.t} desc={t.alt}>
      <Linea x1={24} y1={86} x2={220} y2={86} />
      {[48, 72, 96, 120, 144, 168, 192].map((x) => (
        <Linea key={x} x1={x} y1={83} x2={x} y2={89} />
      ))}
      <Linea x1={128} y1={46} x2={128} y2={128} f="punteada" />
      <path className="s-diag-linea s-diag-linea--tinta" d="M128 104v5h58v-5" />
      <Nodo x={24} y={86} tipo="lleno" />
      <Nodo x={186} y={86} tipo="lleno" />
      <Texto x={24} y={68} ancla="start">{rotulo('llega', lang)}</Texto>
      <Texto x={128} y={38}>{rotulo('plazo', lang)}</Texto>
      <Texto x={157} y={128}>{rotulo('tarde', lang)}</Texto>
    </Envoltura>
  );
}

function Problema4({lang}: P) {
  const t = textosProblema(lang).columnas[3];
  const ys = [34, 66, 98, 130];
  return (
    <Envoltura id="problema-4" ancho={244} alto={160} titulo={t.t} desc={t.alt}>
      {ys.map((y) => (
        <Linea key={y} x1={30} y1={y} x2={118} y2={74} f="tenue" />
      ))}
      {ys.map((y) => (
        <Nodo key={y} x={30} y={y} />
      ))}
      <rect className="s-diag-caja s-diag-caja--solida" x={118} y={52} width={100} height={44} rx={8} />
      <Texto x={168} y={80} clase="s-diag-cifra">N</Texto>
      <rect className="s-diag-caja s-diag-caja--punteada" x={134} y={106} width={68} height={18} rx={9} />
      <Texto x={168} y={142}>{rotulo('sinClase', lang)}</Texto>
    </Envoltura>
  );
}

// ---------- Seguridad: tres organizaciones separadas por barreras ----------
function Seguridad({lang}: P) {
  const t = textosSeguridad(lang);
  const cx = [178, 536, 894];
  return (
    <>
      <div className="s-diag-ancho">
        <Envoltura id="seguridad" ancho={1072} alto={380} titulo={rotulo('tituloSeguridad', lang)} desc={t.alt}>
          {[357, 715].map((x) => (
            <g key={x}>
              <Linea x1={x} y1={24} x2={x} y2={356} />
              <text className="s-diag-rotulo" x={x + 14} y={190} textAnchor="middle" transform={`rotate(-90 ${x + 14} 190)`}>
                {t.barrera}
              </text>
            </g>
          ))}
          {cx.map((x, i) => (
            <g key={x}>
              <Visor x={x - 150} y={40} w={300} h={270} />
              <Grupo cx={x} cy={172} r={124} pulsos={i === 1 ? [0, 2] : [1]} />
              <Texto x={x} y={332}>{t.organizaciones[i]}</Texto>
            </g>
          ))}
        </Envoltura>
      </div>
      <div className="s-diag-angosto" aria-hidden="true">
        <svg className="s-red s-diag" viewBox="0 0 340 600" focusable="false">
          {[198, 398].map((y) => (
            <g key={y}>
              <Linea x1={0} y1={y} x2={340} y2={y} />
              <Texto x={170} y={y - 8}>{t.barrera}</Texto>
            </g>
          ))}
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <Grupo cx={170} cy={78 + i * 200} r={52} pulsos={[1]} />
              <Texto x={170} y={160 + i * 200}>{t.organizaciones[i]}</Texto>
            </g>
          ))}
        </svg>
      </div>
    </>
  );
}

// ---------- Integraciones: nodo central, dos conexiones continuas y tres discontinuas ----------
function Integraciones({lang}: P) {
  const t = textosIntegraciones(lang);
  return (
    <>
      <div className="s-diag-ancho">
        <Envoltura id="integraciones" ancho={800} alto={280} titulo={rotulo('tituloIntegraciones', lang)} desc={t.alt}>
          <Visor x={370} y={110} w={60} h={60} l={10} />
          {[80, 200].map((y) => (
            <g key={y}>
              <Linea x1={400} y1={140} x2={150} y2={y} />
              <Pulso x1={400} y1={140} x2={150} y2={y} />
              <Nodo x={150} y={y} />
            </g>
          ))}
          {[60, 140, 220].map((y) => (
            <g key={y}>
              <Linea x1={400} y1={140} x2={650} y2={y} f="punteada" />
              <Nodo x={650} y={y} />
            </g>
          ))}
          <Nodo x={400} y={140} tipo="central" />
          <Texto x={400} y={188}>{t.central}</Texto>
          <Texto x={134} y={84} ancla="end" clase="s-diag-nombre">{t.hoy[0]}</Texto>
          <Texto x={134} y={204} ancla="end" clase="s-diag-nombre">{t.hoy[1]}</Texto>
          {t.ruta.map((n, i) => (
            <Texto key={n} x={668} y={64 + i * 80} ancla="start" clase="s-diag-nombre s-diag-nombre--tenue">{n}</Texto>
          ))}
          <Texto x={668} y={20} ancla="start">{t.rutaEtiqueta}</Texto>
        </Envoltura>
      </div>
      <div className="s-diag-angosto" aria-hidden="true">
        <svg className="s-red s-diag" viewBox="0 0 340 430" focusable="false">
          <Visor x={140} y={34} w={60} h={60} l={10} />
          {[80, 260].map((x) => (
            <g key={x}>
              <Linea x1={170} y1={64} x2={x} y2={160} />
              <Pulso x1={170} y1={64} x2={x} y2={160} />
              <Nodo x={x} y={160} />
            </g>
          ))}
          <Texto x={80} y={188} clase="s-diag-nombre">{t.hoy[0]}</Texto>
          <Texto x={260} y={188} clase="s-diag-nombre">{t.hoy[1]}</Texto>
          <Linea x1={0} y1={236} x2={340} y2={236} f="punteada" />
          <Texto x={170} y={228}>{t.rutaEtiqueta}</Texto>
          {[60, 170, 280].map((x) => (
            <g key={x}>
              <Linea x1={170} y1={64} x2={x} y2={320} f="punteada" />
              <Nodo x={x} y={320} />
            </g>
          ))}
          {t.ruta.map((n, i) => (
            <Texto key={n} x={[60, 170, 280][i]} y={348} clase="s-diag-nombre s-diag-nombre--tenue">{n}</Texto>
          ))}
          <Nodo x={170} y={64} tipo="central" />
          <Texto x={170} y={110}>{t.central}</Texto>
        </svg>
      </div>
    </>
  );
}

// ---------- Procedencia: fuentes, libro de la organización, tu equipo ----------
function Procedencia({lang}: P) {
  const t = textosProcedencia(lang);
  const desc = rotulo('altProcedencia', lang);
  const hoy = t.fuentes.map((_, i) => i < 3);
  return (
    <>
      <div className="s-diag-ancho">
        <Envoltura id="procedencia" ancho={1072} alto={340} titulo={rotulo('tituloProcedencia', lang)} desc={desc}>
          {t.fuentes.map((f, i) => {
            const y = 40 + i * 52;
            return (
              <g key={f.n}>
                <Linea x1={150} y1={y} x2={430} y2={170} f={hoy[i] ? '' : 'punteada'} />
                {hoy[i] ? <Pulso x1={150} y1={y} x2={430} y2={170} /> : null}
                <Nodo x={150} y={y} />
                <Texto x={134} y={y + 4} ancla="end" clase="s-diag-nombre">{f.n}</Texto>
              </g>
            );
          })}
          <Texto x={150} y={14} ancla="middle">{rotulo('fuentes', lang)}</Texto>
          <rect className="s-diag-caja s-diag-caja--solida" x={430} y={50} width={240} height={190} rx={12} />
          <Visor x={420} y={40} w={260} h={210} />
          <Texto x={550} y={78}>{t.nucleo}</Texto>
          {t.campos.map((c, i) => (
            <g key={c}>
              <Linea x1={452} y1={110 + i * 44} x2={648} y2={110 + i * 44} f="tenue" />
              <Nodo x={452} y={110 + i * 44} tipo="lleno" />
              <Texto x={466} y={106 + i * 44} ancla="start" clase="s-diag-nombre">{c}</Texto>
            </g>
          ))}
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <Linea x1={670} y1={170} x2={920} y2={70 + i * 66} />
              <Nodo x={920} y={70 + i * 66} />
            </g>
          ))}
          <Pulso x1={670} y1={170} x2={920} y2={104} />
          <Texto x={920} y={30}>{t.equipo}</Texto>
          <Linea x1={550} y1={240} x2={550} y2={300} f="punteada" />
          <Nodo x={550} y={300} />
          <Texto x={566} y={304} ancla="start">{rotulo('cuarentena', lang)}</Texto>
        </Envoltura>
      </div>
      <div className="s-diag-angosto" aria-hidden="true">
        <svg className="s-red s-diag" viewBox="0 0 340 460" focusable="false">
          <Texto x={170} y={14}>{rotulo('fuentes', lang)}</Texto>
          {t.fuentes.map((f, i) => {
            const x = 30 + i * 56;
            return (
              <g key={f.n}>
                <Linea x1={x} y1={40} x2={170} y2={120} f={hoy[i] ? '' : 'punteada'} />
                <Nodo x={x} y={40} />
              </g>
            );
          })}
          <rect className="s-diag-caja s-diag-caja--solida" x={40} y={120} width={260} height={150} rx={12} />
          <Texto x={170} y={146}>{t.nucleo}</Texto>
          {t.campos.map((c, i) => (
            <g key={c}>
              <Nodo x={62} y={178 + i * 30} tipo="lleno" />
              <Texto x={76} y={182 + i * 30} ancla="start" clase="s-diag-nombre">{c}</Texto>
            </g>
          ))}
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <Linea x1={170} y1={270} x2={50 + i * 80} y2={350} />
              <Nodo x={50 + i * 80} y={350} />
            </g>
          ))}
          <Texto x={170} y={380}>{t.equipo}</Texto>
          <Linea x1={300} y1={230} x2={320} y2={230} f="punteada" />
          <Texto x={170} y={440}>{rotulo('cuarentena', lang)}</Texto>
        </svg>
      </div>
    </>
  );
}

const DIAGRAMAS = {
  'problema-1': Problema1,
  'problema-2': Problema2,
  'problema-3': Problema3,
  'problema-4': Problema4,
  seguridad: Seguridad,
  integraciones: Integraciones,
  procedencia: Procedencia,
} as const;

export type DiagramaProps = {id: IdDiagrama; lang: Lang};
export function Diagrama({id, lang}: DiagramaProps) {
  const D = DIAGRAMAS[id];
  if (!D) throw new Error(`DIAGRAMA_DESCONOCIDO: ${String(id)}`);
  return <D lang={lang} />;
}
export {IDS_DIAGRAMA};
export type {IdDiagrama, Lang};
