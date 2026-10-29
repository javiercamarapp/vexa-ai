import type {Traductor} from '../../lib/i18n';
// Ilustraciones de interfaz dibujadas con HTML, CSS y SVG con atributos de presentación. Sin atributo style: las alturas salen de atributos SVG y los tonos de atributos de datos.
// Todas las cifras son sintéticas y cada ilustración va rotulada como datos sintéticos de demostración; ninguna aparece en el texto como afirmación.
type P = {t: Traductor};
const PUNTOS_SPARK = ['0,18 12,15 24,16 36,10 48,12 60,6 72,8 80,3', '0,12 12,14 24,9 36,11 48,7 60,9 72,5 80,6', '0,8 12,10 24,7 36,12 48,9 60,14 72,12 80,16', '0,16 12,12 24,14 36,9 48,10 60,7 72,9 80,4'];
const BARRAS = [46, 52, 49, 61, 58, 67, 63, 72, 69, 78, 74, 88];
const PARETO = [92, 70, 56, 44, 34, 27, 21, 16, 12, 9];
const CANALES = [78, 46, 24];
function Marco({etiqueta, children, clase = ''}: {etiqueta: string; children: React.ReactNode; clase?: string}) {
  return <div className={'vent ' + clase} role="img" aria-label={etiqueta}>
    <div className="vent-barra" aria-hidden="true"><i /><i /><i /></div>
    <div className="vent-cuerpo" aria-hidden="true">{children}</div>
  </div>;
}
function Rotulo({t}: P) { return <figcaption className="sint">{t('landing.sintetico')}</figcaption>; }
function Spark({i}: {i: number}) { return <svg className="spark" viewBox="0 0 80 22" width="80" height="22" focusable="false"><polyline points={PUNTOS_SPARK[i]} fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>; }

export function MockHoy({t}: P) {
  const menu = ['landing.m.hoy', 'landing.m.pregunta', 'landing.m.reembolsos', 'landing.m.problemas', 'landing.m.puntos', 'landing.m.carga', 'landing.m.confianza'] as const;
  const kpis = [['landing.m.k1', '$480,000', 480000], ['landing.m.k2', '$36,000', 36000], ['landing.m.k3', '$9,000', 9000], ['landing.m.k4', '14%', 0]] as const;
  return <figure className="mock tilt">
    <Marco etiqueta={`${t('landing.m.hoy')}. ${t('landing.sintetico')}`} clase="vent-hoy">
      <ul className="vm-menu">{menu.map((k, i) => <li key={k} data-activo={i === 0 ? '' : undefined}>{t(k)}</li>)}</ul>
      <div className="vm-main">
        <div className="vm-cab"><b>{t('landing.m.hoy')}</b><span className="vm-org">{t('landing.m.org')}</span><span className="vm-chip">{t('landing.m.periodo')}</span><span className="vm-btn">{t('landing.m.exportar')}</span></div>
        <div className="vm-kpis">{kpis.map(([k, v], i) => <div className="kpi" key={k}><small>{t(k)}</small><strong>{v}</strong><Spark i={i} /><em className="etq">{t('landing.val.obs')}{i === 1 ? <u className="punto-rojo" /> : null}</em></div>)}</div>
        <div className="vm-fila">
          <div className="vm-graf"><small>{t('landing.m.tendencia')}</small>
            <svg viewBox="0 0 288 100" width="288" height="100" preserveAspectRatio="none" focusable="false">
              {BARRAS.map((h, i) => <rect key={i} className={i === 11 ? 'b b-fuerte' : 'b'} x={i * 24 + 3} y={100 - h} width="16" height={h} rx="2" />)}
            </svg></div>
          <div className="vm-aviso"><small>{t('landing.m.atencion')}</small><p>{t('landing.m.atencion1')}</p><p>{t('landing.m.atencion2')}</p></div>
        </div>
      </div>
    </Marco>
    <Rotulo t={t} />
  </figure>;
}

export function MockFuentes({t}: P) {
  const filas = [['landing.m.s1', 'landing.m.alDia', '12 Oct'], ['landing.m.s2', 'landing.m.manual', '10 Oct'], ['landing.m.s3', 'landing.m.alDia', '12 Oct']] as const;
  return <figure className="mock">
    <Marco etiqueta={`${t('landing.m.fuentes')}. ${t('landing.sintetico')}`}>
      <div className="vm-main solo">
        <div className="vm-cab"><b>{t('landing.m.fuentes')}</b></div>
        <ul className="lista-f">{filas.map(([n, e, c]) => <li key={n}><span>{t(n)}</span><span className="pill" data-tono={e === 'landing.m.alDia' ? 'ok' : 'neutro'}>{t(e)}</span><span className="mono">{t('landing.m.corte')} {c}</span></li>)}</ul>
        <div className="vm-prev"><small>{t('landing.m.vista')}</small>
          <div className="tabla"><span>{t('landing.m.s2')}</span><span className="mono">{t('landing.m.filas')} 1,240</span></div>
          <div className="barra-prog"><svg viewBox="0 0 200 6" width="200" height="6" preserveAspectRatio="none" focusable="false"><rect className="b" x="0" y="0" width="200" height="6" rx="3" opacity=".2" /><rect className="b b-fuerte" x="0" y="0" width="148" height="6" rx="3" /></svg></div>
        </div>
      </div>
    </Marco>
    <Rotulo t={t} />
  </figure>;
}

export function MockProblemas({t}: P) {
  const filas = [['landing.m.p1', 'landing.m.alta', '$14,200', 'obs', 38], ['landing.m.p2', 'landing.m.media', '$8,600', 'est', 21], ['landing.m.p3', 'landing.m.media', '$3,100', 'inf', 12]] as const;
  const etq: Record<string, 'landing.val.obs' | 'landing.val.est' | 'landing.val.inf'> = {obs: 'landing.val.obs', est: 'landing.val.est', inf: 'landing.val.inf'};
  return <figure className="mock">
    <Marco etiqueta={`${t('landing.m.problemas')}. ${t('landing.sintetico')}`}>
      <div className="vm-main solo">
        <div className="vm-cab"><b>{t('landing.m.problemas')}</b></div>
        <ul className="lista-p">{filas.map(([n, s, m, e, c], i) => <li key={n} data-activo={i === 0 ? '' : undefined}><span className="p-n">{t(n)}</span><span className="pill" data-tono={s === 'landing.m.alta' ? 'alerta' : 'neutro'}>{t(s)}</span><span className="mono">{m}</span><em className="etq">{t(etq[e])}</em><span className="mono tenue">{c} {t('landing.m.casos')}</span></li>)}</ul>
        <blockquote className="cita"><small>{t('landing.m.cita')}</small>{t('landing.m.citaTxt')}</blockquote>
      </div>
    </Marco>
    <Rotulo t={t} />
  </figure>;
}

export function MockReembolsos({t, contar = false}: P & {contar?: boolean}) {
  return <figure className="mock">
    <Marco etiqueta={`${t('landing.m.reembolsos')}. ${t('landing.sintetico')}`}>
      <div className="vm-main solo">
        <div className="vm-cab"><b>{t('landing.m.reembolsos')}</b></div>
        <p className="gran"><strong data-contar={contar ? '36000' : undefined}>$36,000</strong> <span>{t('landing.m.devueltos')}</span></p>
        <div className="vm-graf"><small>{t('landing.m.pareto')}</small>
          <svg viewBox="0 0 280 80" width="280" height="80" preserveAspectRatio="none" focusable="false">
            {PARETO.map((h, i) => <rect key={i} className={i < 3 ? 'b b-fuerte' : 'b'} x={i * 28 + 4} y={80 - h * 0.8} width="20" height={h * 0.8} rx="2" />)}
            <polyline className="linea-acum" points="14,10 42,22 70,30 98,38 126,44 154,48 182,52 210,54 238,56 266,57" fill="none" strokeWidth="1.4" />
          </svg></div>
        <ul className="canales">{CANALES.map((w, i) => <li key={i}><span>{t('landing.m.canal')} {'ABC'[i]}</span><svg viewBox="0 0 100 6" width="100" height="6" preserveAspectRatio="none" focusable="false"><rect className="b" x="0" y="0" width="100" height="6" rx="3" opacity=".18" /><rect className={i === 0 ? 'b b-fuerte' : 'b'} x="0" y="0" width={w} height="6" rx="3" /></svg></li>)}</ul>
        <span className="vm-btn solido">{t('landing.m.paquete')}</span>
      </div>
    </Marco>
    <Rotulo t={t} />
  </figure>;
}

export function Miniatura({n, t}: {n: number; t: Traductor}) {
  if (n === 1) return <svg className="mini" viewBox="0 0 160 70" width="160" height="70" aria-hidden="true" focusable="false">{[0, 1, 2, 3].map((i) => <g key={i}><rect className="m-caja" x={i * 40 + 1} y="4" width="36" height="34" rx="4" /><rect className="b" x={i * 40 + 6} y="10" width="14" height="3" rx="1.5" opacity=".4" /><rect className="b b-fuerte" x={i * 40 + 6} y="18" width="24" height="6" rx="2" /></g>)}<polyline className="linea-acum" points="2,64 30,56 58,60 86,48 114,50 142,40 158,44" fill="none" strokeWidth="1.6" /></svg>;
  if (n === 2) return <div className="mini mini-chat" aria-hidden="true"><span className="burb">{t('landing.m.pregTxt')}</span><span className="burb resp"><i /><i /><i /></span><small className="mono">{t('landing.m.pasos')}</small></div>;
  if (n === 3) return <svg className="mini" viewBox="0 0 160 70" width="160" height="70" aria-hidden="true" focusable="false">{PARETO.map((h, i) => <rect key={i} className={i < 3 ? 'b b-fuerte' : 'b'} x={i * 16 + 2} y={68 - h * 0.65} width="11" height={h * 0.65} rx="2" />)}</svg>;
  if (n === 4) return <svg className="mini" viewBox="0 0 160 70" width="160" height="70" aria-hidden="true" focusable="false">{[[30, 36, 20], [64, 26, 13], [92, 44, 16], [118, 24, 9], [140, 46, 11], [52, 54, 7], [100, 16, 6]].map(([x, y, r], i) => <circle key={i} className={i === 0 ? 'b b-fuerte' : 'b b-suave'} cx={x} cy={y} r={r} />)}</svg>;
  if (n === 5) return <div className="mini mini-calor" aria-hidden="true">{Array.from({length: 7 * 16}, (_, i) => { const d = Math.floor(i / 16), h = i % 16; const v = Math.max(0, Math.min(4, Math.round(((Math.sin(h / 2.2 - 1) + 1) * 1.6 + ((d * 7 + h * 3) % 3) * 0.3) - (d > 4 ? 1.1 : 0)))); return <i key={i} data-n={v} />; })}</div>;
  return <div className="mini mini-etq" aria-hidden="true"><em className="etq">{t('landing.val.obs')}</em><em className="etq">{t('landing.val.est')}</em><em className="etq">{t('landing.val.inf')}</em><em className="etq sin">{t('landing.val.sin')}</em><small className="mono">{t('landing.m.origen')} / {t('landing.m.fresco')}</small></div>;
}

/** Maqueta sintética de cada pantalla de la sección de capacidades, siempre con su rótulo de datos de ejemplo. */
export function Mockup({n, t}: {n: number; t: Traductor}) {
  if (n === 1) return <MockHoy t={t} />;
  if (n === 3) return <MockReembolsos t={t} />;
  if (n === 4) return <MockProblemas t={t} />;
  if (n === 6) return <MockFuentes t={t} />;
  if (n === 2) return <figure className="mock"><Marco etiqueta={`${t('landing.m.pregunta')}. ${t('landing.sintetico')}`} clase="vent-mini"><div className="mini-caja pq">
    <b className="mini-tit">{t('landing.m.pregunta')}</b>
    <span className="pq-q">{t('landing.m.pregTxt')}</span>
    <div className="pq-a">
      <svg viewBox="0 0 240 64" width="240" height="64" focusable="false">{CANALES.map((w, i) => <g key={i}><rect className="b" x="64" y={6 + i * 20} width={w * 1.7} height="12" rx="2" /><text x="0" y={16 + i * 20} className="pq-t">{t('landing.m.canal')} {'ABC'[i]}</text></g>)}</svg>
      <em className="etq">{t('landing.val.obs')}</em>
      <small className="mono">{t('landing.m.pasos')}</small>
    </div></div></Marco><Rotulo t={t} /></figure>;
  return <figure className="mock"><Marco etiqueta={`${t('landing.m.carga')}. ${t('landing.sintetico')}`} clase="vent-mini"><div className="mini-caja"><b className="mini-tit">{t('landing.m.carga')}</b><Miniatura n={5} t={t} /><small className="mono">{t('landing.m.horas')}</small></div></Marco><Rotulo t={t} /></figure>;
}
