'use client';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {PageHeader} from '../ui/page-header';
import {BarChart, type BarDatum} from '../ui/bar-chart';
import {Button, LinkButton, Download, Refresh} from '../ui/button';
import {KindBadge} from '../ui/kind-badge';
import {CopilotPanel} from '../platform/copilot-panel';
import {DataTable, type Column} from '../platform/data-table';
import {PfIcon} from '../platform/icons';
import {Empty, HowTo, Panel, Pill, Seg, Tile, severityTone} from '../platform/primitives';
import {CFO_SHORTCUTS} from '../../../../../packages/cfo-copilot/src/client.mjs';
import type {CfoReport, CurrencyBlock} from '../../../../../packages/cfo-copilot/src/index.mjs';
import {changeBps, int, monthLabel, pct, signedPct} from '../../../../../packages/cfo-copilot/src/format.mjs';
import {MonthBars} from './month-bars';
import {seriesPoints, type Measure} from './series';
import './cfo.css';

export type ReportState = {status: 'ok'; report: CfoReport; synthetic: boolean; exposureStatus?: string} | {status: 'empty' | 'timeout'; synthetic?: boolean; summary?: {freshness: string; label: string | null; missingMonths?: string[] | null}};
const MEASURES: ReadonlyArray<{value: Measure; label: string}> = [{value: 'ingresos', label: 'Ingresos'}, {value: 'pedidos', label: 'Pedidos'}, {value: 'reembolsos', label: 'Reembolsos'}, {value: 'tasa', label: 'Tasa de reembolso'}];
const SEVERITY: Record<string, string> = {alta: 'Alta', media: 'Media', baja: 'Baja', info: 'Informativa'};
const AFTER_SAVE = 'Los datos de demostración son sintéticos y no pertenecen a ninguna organización.';
const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat('es-MX', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(new Date(iso)) : 'no informado');

export function CfoDashboard({initial, query = '', organization}: {initial: ReportState; query?: string; organization?: string}) {
  const [state, setState] = useState<ReportState>(initial), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [currency, setCurrency] = useState<string>(initial.status === 'ok' ? initial.report.currencies[0] : ''), [measure, setMeasure] = useState<Measure>('ingresos');
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const r = await fetch('/cfo/data/report' + query, {cache: 'no-store', signal: AbortSignal.timeout(20000)});
      const j = await r.json(); if (!r.ok) throw new Error(j?.error?.code ?? 'cfo_unavailable');
      setState(j.data); if (j.data.status === 'ok' && !j.data.report.currencies.includes(currency)) setCurrency(j.data.report.currencies[0]);
    } catch { setError('No se pudo actualizar el panel. Conservo las cifras anteriores; reintenta en unos segundos.'); } finally { setBusy(false); }
  }, [query, currency]);
  useEffect(() => { const again = () => void load(); window.addEventListener('vexa:refresh', again); return () => window.removeEventListener('vexa:refresh', again); }, [load]);

  const ok = state.status === 'ok' ? state : null, report = ok?.report;
  const actions = <>
    <CopilotPanel endpoint={'/cfo/data/copilot' + query} title="Copiloto CFO" subtitle="Tus ingresos, reembolsos y calidad de datos, con la cifra que ya calculó el panel." placeholder="Pregunta sobre tus ingresos, canales o reembolsos…" shortcuts={CFO_SHORTCUTS} openLabel="Copiloto CFO" context="Pregunta a tus cifras" />
    <Button icon={<Refresh />} loading={busy} onClick={() => void load()}>Actualizar</Button>
    <LinkButton href="/cfo/data/export?format=csv" download="informe-cfo.csv" icon={<Download />}>Exportar CSV</LinkButton>
    <LinkButton href="/cfo/data/export?format=pdf" download="informe-cfo.pdf" icon={<Download />}>Exportar PDF</LinkButton>
  </>;
  const header = <PageHeader eyebrow="CFO del negocio" title="CFO del negocio" description="Ingresos, reembolsos, mezcla por canal y calidad de datos, por moneda y sin mezclar bases. Cada cifra dice si es observada, estimada o inferida, y cómo se calculó." actions={actions} />;
  if (!report) return <div className="cf-page">{header}{error && <p className="state state-error" role="alert">{error}</p>}
    {state.status === 'timeout'
      ? <Empty tone="bad" title="No disponible ahora" action={<Button icon={<Refresh />} loading={busy} onClick={() => void load()}>Reintentar</Button>}>La consulta acotada del ledger superó el tiempo permitido{state.status === 'timeout' && state.summary && ['absent', 'partial', 'unavailable'].includes(state.summary.freshness) ? ' y todavía no hay un resumen precomputado completo de los últimos 12 meses (pide a un operador refrescarlo)' : ''}. No se muestra ninguna cifra parcial como si fuera completa.</Empty>
      : <Empty title="Sin asientos en el ledger" action={<LinkButton href="/economics" icon={<PfIcon name="database" />}>Ir a Gestión económica</LinkButton>}>Aún no hay pedidos ni reembolsos registrados para esta organización en los últimos 12 meses. Carga una fuente para ver el panel financiero.</Empty>}</div>;

  const block = report.perCurrency.find(c => c.currency === currency) ?? report.perCurrency[0];
  const kpis = report.kpis.find(k => k.currency === block.currency)!;
  return <div className="cf-page">
    {header}
    {error && <p className="state state-error" role="alert">{error}</p>}
    <div className="pf-statusbar" role="status">
      {ok?.synthetic && <Pill tone="warn">Datos sintéticos de demostración</Pill>}
      <span>{organization ?? 'Organización'}</span><span>Corte de datos: <strong>{when(report.watermark)}</strong></span><span>Último mes completo: <strong>{report.lastComplete ? monthLabel(report.lastComplete) : 'ninguno'}</strong></span><span>{int(report.quality.totalRows)} asientos</span>
      {report.summary?.source === 'summary' && report.summary.label && <Pill tone={report.summary.freshness === 'fresh' ? 'ok' : 'warn'}>{report.summary.label}</Pill>}
      {!report.complete && <Pill tone="warn">Resultado truncado</Pill>}
    </div>
    <div className="pf-banner" role="note"><PfIcon name="info" /><p><strong>USD, CAD y MXN no se suman ni se convierten.</strong> No hay tipos de cambio aprobados (economic_fx_versions está vacío), así que cada moneda se muestra aparte. Tampoco se restan reembolsos de ingresos: usan bases económicas distintas.</p></div>
    <nav className="pf-anchors" aria-label="Secciones del panel">{[['resumen', 'Resumen'], ['alertas', 'Alertas'], ['tendencias', 'Tendencias'], ['mezcla', 'Mezcla por canal'], ['calidad', 'Calidad de datos'], ['exposicion', 'Exposición'], ['proyecciones', 'Proyecciones'], ['glosario', 'Glosario']].map(([id, label]) => <LinkButton key={id} href={'#' + id} size="sm">{label}</LinkButton>)}</nav>

    <Panel id="resumen" eyebrow={`Último mes completo · ${report.lastComplete ? monthLabel(report.lastComplete) : '—'}`} title="Resumen por moneda" actions={<Seg label="Moneda" value={block.currency} options={report.currencies.map(c => ({value: c, label: c}))} onChange={setCurrency} />}
      lead={report.prevComplete ? `Variaciones contra ${monthLabel(report.prevComplete)}. Los meses incompletos no se comparan.` : 'Se necesitan dos meses completos para comparar.'}>
      <div className="pf-tiles reveal">{kpis.metrics.map(m => <Tile key={m.id} label={m.label} value={m.display} kind={m.kind} delta={m.delta} foot={m.scope} coverage={m.coverage.eligible === null ? null : m.coverage.label} how={m.how} />)}</div>
      {!kpis.metrics.some(m => m.id.startsWith('refund:')) && <p className="pf-banner" role="note"><PfIcon name="info" />Sin reembolsos registrados en {block.currency}: no se calcula la tasa de reembolso (no es 0 %, es «sin fuente»).</p>}
      {block.orderBases.length > 1 && <p className="card-lead">En {block.currency} hay {block.orderBases.length} bases de ingreso que no se suman: {block.orderBases.map(b => b.label).join(' · ')}. El resumen usa «{block.orderBases[0].label}».</p>}
    </Panel>

    <Panel id="alertas" eyebrow="Atención" title={`Alertas (${report.alerts.filter(a => a.severity !== 'info').length} activas)`} lead="Reglas deterministas sobre las cifras observadas; cada una dice cómo se calculó.">
      {report.alerts.length === 0 ? <Empty title="Sin alertas">Ninguna regla se activó con los datos actuales.</Empty> :
        <ul className="pf-list">{report.alerts.map(a => <li key={a.id}>
          <div className="pf-li-main"><div className="pf-li-head"><Pill tone={severityTone(a.severity)}>{SEVERITY[a.severity]}</Pill><KindBadge kind={a.kind} /></div><strong>{a.title}</strong><span>{a.detail}</span><HowTo text={a.how} /></div>
          {a.cta && <LinkButton href={a.cta.href} size="sm" icon={<PfIcon name="chevron" size={14} />}>{a.cta.label}</LinkButton>}
        </li>)}</ul>}
    </Panel>

    <Trends report={report} block={block} measure={measure} setMeasure={setMeasure} />
    <Mix report={report} />
    <Quality report={report} />
    <Exposure report={report} />
    <Projections report={report} block={block} />

    <Panel id="glosario" eyebrow="Referencia" title="Glosario y cómo leer las cifras">
      <dl className="cf-glossary">{report.glossary.map(g => <div key={g.term}><dt>{g.term}</dt><dd>{g.body}</dd></div>)}</dl>
      <p className="card-lead">{ok?.synthetic ? AFTER_SAVE : 'Las cifras provienen del ledger económico de esta organización (última revisión de cada asiento). Los exportes CSV y PDF contienen exactamente las mismas cifras que esta pantalla.'}</p>
    </Panel>
  </div>;
}


type Row = {month: string; partial: boolean; orders: number; revenue: string; ticket: string; refunds: number; refundAmount: string; rate: string; mom: string | null};
function Trends({report, block, measure, setMeasure}: {report: CfoReport; block: CurrencyBlock; measure: Measure; setMeasure: (m: Measure) => void}) {
  const view = seriesPoints(block, measure), line = block.orderBases[0];
  const rows: Row[] = useMemo(() => line.series.map((s, i) => {
    const prev = i > 0 ? line.series[i - 1] : null, ref = block.refunds.series[i], rate = block.rate.series[i];
    const mom = prev && !s.partial && !prev.partial && s.known > 0 && prev.known > 0 ? signedPct(changeBps(BigInt(s.amount), BigInt(prev.amount))) : null;
    return {month: s.month, partial: s.partial, orders: s.n, revenue: s.amountDisplay, ticket: s.ticketDisplay ?? 'No disponible', refunds: ref.n, refundAmount: ref.n ? ref.amountDisplay : '—', rate: rate.display, mom};
  }), [line, block]);
  const cols: Column<Row>[] = [
    {id: 'month', header: 'Mes', cell: r => <>{monthLabel(r.month)}{r.partial && <Pill tone="warn">Incompleto</Pill>}</>, sort: r => r.month},
    {id: 'orders', header: 'Pedidos', align: 'right', cell: r => int(r.orders), sort: r => r.orders},
    {id: 'revenue', header: 'Ingresos', align: 'right', cell: r => r.revenue},
    {id: 'ticket', header: 'Ticket promedio', align: 'right', cell: r => r.ticket},
    {id: 'mom', header: 'Ingresos vs mes anterior', align: 'right', cell: r => r.mom ?? '—'},
    {id: 'refunds', header: 'Reembolsos', align: 'right', cell: r => int(r.refunds), sort: r => r.refunds},
    {id: 'refundAmount', header: 'Importe reembolsado', align: 'right', cell: r => r.refundAmount},
    {id: 'rate', header: 'Tasa', align: 'right', cell: r => r.rate},
  ];
  const others = block.orderBases.slice(1);
  return <Panel id="tendencias" eyebrow={`Últimos ${report.months.length} meses · ${block.currency}`} title="Tendencias y comparativa mes contra mes" actions={<Seg label="Medida" value={measure} options={MEASURES} onChange={setMeasure} />}>
    <MonthBars key={measure + block.currency} title={view.title} unit={view.unit} points={view.points} note={view.note} exponent={view.exponent} />
    <details className="trend-table cf-monthly"><summary>Ver comparativa mensual completa</summary>
      <DataTable caption={`Comparativa mensual en ${block.currency}`} rows={rows} columns={cols} rowKey={r => r.month} pageSize={24} initialSort={{id: 'month', dir: 'desc'}} />
      <p className="card-lead">La variación solo se calcula entre dos meses completos. «—» significa que no es comparable o que falta el importe.</p></details>
    {others.length > 0 && <div className="cf-others"><h3>Otras bases en {block.currency} (no se suman a las de arriba)</h3><ul className="pf-list">{others.map(b => <li key={b.base}><div className="pf-li-main"><strong>{b.label}</strong><span>{b.channels.map(c => c.label).join(', ')} · {int(b.total.n)} pedidos · {b.series.at(-2)?.amountDisplay ?? '—'} en {monthLabel(b.series.at(-2)?.month ?? '')}</span></div><KindBadge kind="observed" /></li>)}</ul></div>}
  </Panel>;
}

function Mix({report}: {report: CfoReport}) {
  const data: BarDatum[] = report.mix.orders.map(o => ({key: o.channel, label: o.label, value: o.shareBps ?? 0, display: `${int(o.n)} · ${pct(o.shareBps)}`, kind: 'observed'}));
  return <Panel id="mezcla" eyebrow="12 meses · pedidos registrados" title="Mezcla por canal" lead="Participación por conteo de pedidos (no depende de moneda). Los importes se reparten solo dentro de la misma moneda y la misma base.">
    <div className="pf-grid-2">
      <div><BarChart title="Pedidos por canal" unit="% de pedidos" data={data} /><HowTo text={report.mix.ordersFig.how} /></div>
      <div className="cf-mixcur">{report.mix.byCurrency.map(g => <section key={g.currency + g.base} aria-label={`${g.currency} ${g.baseLabel}`}>
        <h3>{g.currency} <span className="pf-sub">{g.baseLabel} · total {g.total}</span></h3>
        <ul className="cf-mixlist">{g.items.map(i => <li key={i.channel}><span>{i.label}</span><span className="cf-mixbar" role="img" aria-label={`${i.label}: ${pct(i.shareBps)}`}><span style={{width: Math.max(1, (i.shareBps ?? 0) / 100) + '%'}} /></span><strong>{pct(i.shareBps)}</strong><small>{i.display}</small></li>)}</ul>
      </section>)}</div>
    </div>
  </Panel>;
}

function Quality({report}: {report: CfoReport}) {
  const q = report.quality, figs = [q.figs.rows, q.figs.noCurrency, q.figs.ordersNoAmount, q.figs.refundsNoAmount, q.figs.toReview];
  const cols: Column<(typeof q.byChannel)[number]>[] = [
    {id: 'channel', header: 'Canal', cell: r => <>{r.label}{!r.hasRefundSource && <small className="pf-sub">Sin fuente de devoluciones</small>}</>, sort: r => r.label},
    {id: 'rows', header: 'Asientos', align: 'right', cell: r => int(r.rows), sort: r => r.rows},
    {id: 'nc', header: 'Sin moneda', align: 'right', cell: r => int(r.noCurrency), sort: r => r.noCurrency},
    {id: 'oa', header: 'Pedidos sin importe', align: 'right', cell: r => int(r.ordersNoAmount), sort: r => r.ordersNoAmount},
    {id: 'ra', header: 'Reembolsos sin importe', align: 'right', cell: r => int(r.refundsNoAmount), sort: r => r.refundsNoAmount},
    {id: 'comp', header: 'Completitud', cell: r => <span className="cf-comp"><span className="cov-track" role="img" aria-label={`Completitud ${pct(r.completenessBps)}`}><span className="cov-seg cov-in" style={{flexBasis: (r.completenessBps ?? 0) / 100 + '%'}} />{(r.completenessBps ?? 0) < 10000 && <span className="cov-seg cov-rej" style={{flexBasis: Math.max(1, 100 - (r.completenessBps ?? 0) / 100) + '%'}} />}</span><strong>{pct(r.completenessBps)}</strong></span>, sort: r => r.completenessBps},
  ];
  return <Panel id="calidad" eyebrow="Qué tan completo está lo que ves" title="Calidad de datos y su costo" lead="Cada fila sin moneda o sin importe queda fuera de los totales. Aquí se cuenta y se estima cuánto representa.">
    <div className="pf-tiles">{figs.map(f => <Tile key={f.id} label={f.label} value={f.display} kind={f.kind} foot={f.scope} coverage={f.coverage.eligible === null ? null : f.coverage.label} how={f.how} />)}</div>
    <DataTable caption="Calidad de datos por canal" rows={q.byChannel} columns={cols} rowKey={r => r.channel} />
    <h3 className="cf-h3">Costo de la mala calidad <KindBadge kind="estimated" /></h3>
    <p className="card-lead">Estimado: lo que valdrían los registros sin importe si tuvieran el ticket promedio conocido de su canal. No se suma a los ingresos observados.</p>
    <div className="pf-tiles">{q.unaccounted.flatMap(u => [u.orderFig, u.refundFig]).map(f => <Tile key={f.id} label={f.label} value={f.display} kind="estimated" foot={f.scope} how={f.how} />)}
      <Tile label="Filas sin moneda" value={int(q.notEstimable.rows)} kind="observed" foot="No estimable" how={q.notEstimable.reason} /></div>
  </Panel>;
}

function Exposure({report}: {report: CfoReport}) {
  const e = report.exposure;
  return <Panel id="exposicion" eyebrow="Problemas con dinero detrás" title="Exposición económica por problema" actions={<KindBadge kind="inferred" />}>
    {e.state === 'sin_atestar' ? <Empty title="Sin atestar" action={e.cta && <LinkButton href={e.cta.href} icon={<PfIcon name="user" />}>{e.cta.label}</LinkButton>}>{e.message}</Empty> : <>
      <p className="card-lead">{e.note}{e.coverageComplete ? '' : ' La cobertura de vínculos no está declarada completa: son pisos, no totales.'}</p>
      <DataTable caption="Exposición por problema" rows={e.rows} rowKey={r => r.problemId} columns={[
        {id: 'p', header: 'Problema', wrap: true, cell: r => r.title, sort: r => r.title}, {id: 'v', header: 'Exposición', align: 'right', cell: r => r.display},
        {id: 'o', header: 'Pedidos vinculados', align: 'right', cell: r => `${int(r.linkedOrders)} (${r.coverage.known} con importe)`, sort: r => r.linkedOrders}]} />
      <HowTo text={e.rows[0]?.how ?? ''} /></>}
  </Panel>;
}

function Projections({report, block}: {report: CfoReport; block: CurrencyBlock}) {
  const list = report.projections.filter(p => p.currency === block.currency);
  return <Panel id="proyecciones" eyebrow="Estimado · nunca presentado como observado" title="Proyecciones a 3 meses" actions={<KindBadge kind="estimated" />}>
    {list.length === 0 ? <Empty title="No estimable">Se necesitan al menos 4 meses completos de {block.currency} para estimar una tendencia.</Empty> : <div className="pf-grid-2">{list.map(p => <div key={p.id}>
      <MonthBars key={p.id} title={p.label} unit={p.metric === 'ingresos' ? p.currency : 'pedidos'} kind="estimated" points={p.points.map(pt => ({month: pt.month, value: pt.mid, label: pt.midDisplay, detail: `rango ${pt.lowDisplay} a ${pt.highDisplay}`}))} />
      <p className="card-lead"><strong>Método.</strong> {p.method}</p></div>)}</div>}
  </Panel>;
}
