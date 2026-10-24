'use client';
import {RovaqCargando} from '../rovaq-cargando';
import {useCallback, useMemo} from 'react';
import {useJson} from '../ui/use-json';
import {useAcceso} from '../workspace/access';
import {LineaCache} from '../ui/linea-cache';
import {useVistaPersistente} from '../workspace/vista-persistente';
import {EsperaEsqueleto} from '../ui/wait-status';
import {PageHeader} from '../ui/page-header';
import {Button,LinkButton,Download} from '../ui/button';
import {KindBadge} from '../ui/kind-badge';
import {Card} from '../ui/card';
import {Chip} from '../ui/chip';
import {FilterBar, FilterSpacer} from '../ui/filter-bar';
import {KpiStrip, type Kpi} from '../ui/kpi-strip';
import {Notice} from '../ui/notice';
import {MenuList,Popover} from '../ui/overlay';
import {ErrorState} from '../ui/error-state';
import {SegmentedControl} from '../ui/segmented';
import {DataTable, type Column} from '../ui/data-table';
import {EmptyState} from '../ui/empty-state';
import {Fila, ListaBarras, Vacio, type ItemBarra} from '../dinero/partes';
import {HowTo} from '../platform/primitives';
import type {CfoReport, CurrencyBlock} from '../../../../../packages/cfo-copilot/src/index.mjs';
import {changeBps, int, monthLabel, pct, signedPct} from '../../../../../packages/cfo-copilot/src/format.mjs';
import {MonthBars} from './month-bars';
import {explicarVariacion} from '../../lib/legibilidad/caida.mjs';
import {seriesPoints, type Measure} from './series';
import './cfo.css';
import '../dinero/dinero.css';
import {lineaDatosHasta} from '../../../../../packages/workspace-service/datos-hasta.mjs';

export type ReportState = {status: 'ok'; report: CfoReport; synthetic: boolean; exposureStatus?: string} | {status: 'empty' | 'timeout'; synthetic?: boolean; summary?: {freshness: string; label: string | null; missingMonths?: string[] | null}};
const MEASURES: ReadonlyArray<{value: Measure; label: string}> = [{value: 'ingresos', label: 'Ingresos'}, {value: 'pedidos', label: 'Pedidos'}, {value: 'reembolsos', label: 'Reembolsos'}, {value: 'tasa', label: 'Tasa de reembolso'}];
const SEVERITY: Record<string, string> = {alta: 'Alta', media: 'Media', baja: 'Baja', info: 'Informativa'};
const AFTER_SAVE = 'Los datos de demostración son sintéticos y no pertenecen a ninguna organización.';

const acceptReporte = (j: unknown): ReportState | null => { const d = (j as {data?: ReportState})?.data; return d && (d.status === 'ok' || d.status === 'empty' || d.status === 'timeout') ? d : null; };
const ROLES_CFO = ['owner', 'analyst'];
/** Informe clásico de CFO (se abre desde el copiloto con «Ver detalle» / «Ver informe completo»: /cfo?vista=informe). */
export function CfoDashboard({query = '', organization, roleOverride, volverA = '/cfo'}: {query?: string; organization?: string; roleOverride?: string; volverA?: string}) {
  const {role} = useAcceso();
  // Caché stale-while-revalidate (swr.mjs): al volver al panel se pinta al instante el último informe, rotulado, y se revalida sin vaciar la pantalla.
  const permitido = ROLES_CFO.includes(roleOverride ?? role);
  const rep = useJson<ReportState>(permitido ? '/cfo/data/report' + query : null, acceptReporte);
  const [pick, setPick] = useVistaPersistente<string>('cfo:moneda', ''), [measure, setMeasure] = useVistaPersistente<Measure>('cfo:medida', 'ingresos');
  const state = rep.data, busy = rep.busy, error = rep.error;
  const currency = state?.status === 'ok' ? (state.report.currencies.includes(pick) ? pick : state.report.currencies[0]) : pick, setCurrency = setPick;
  const load = useCallback(async () => { await rep.reload(); }, [rep]);
  const ok = state?.status === 'ok' ? state : null, report = ok?.report;
  const actions = <>
    <LinkButton href={volverA} variant="primary">Volver al copiloto CFO</LinkButton>
    <Popover label="Exportar" align="end" width={220} triggerClassName="btn btn-secondary" trigger={<><Download /><span className="btn-label">Exportar</span></>}>
      <MenuList>
        <li><LinkButton size="sm" href="/cfo/data/export?format=csv" download="informe-cfo.csv" icon={<Download />}>Informe CSV</LinkButton></li>
        <li><LinkButton size="sm" href="/cfo/data/export?format=pdf" download="informe-cfo.pdf" icon={<Download />}>Informe PDF</LinkButton></li></MenuList></Popover>
  </>;
  const header = <PageHeader eyebrow="Dinero · CFO" title="Informe de CFO" description="Ingresos, reembolsos, canales y calidad de datos por moneda, sin mezclar bases; cada cifra dice cómo se calculó." actions={actions} />;
  if (!permitido) return <div className="dg-page"><PageHeader eyebrow="Dinero · CFO" title="Informe de CFO" description="Panel financiero para propietarios y analistas." />
    <Card><EmptyState art="shield" title="Tu rol no tiene acceso a este panel" body="El informe CFO muestra ingresos, reembolsos y exposición económica. Solo lo ven los propietarios y analistas; pide acceso a un propietario." action={<LinkButton href="/overview">Volver al resumen</LinkButton>} /></Card></div>;
  if (!state && busy && !error) return <RovaqCargando mensaje="" />;
  if (!report) return <div className="dg-page">{header}{error && <ErrorState title="No disponible ahora" body={error} onRetry={() => void load()} />}
    {!state ? (busy ? <EsperaEsqueleto que="el informe del negocio" filas={5} /> : null)
    : state.status === 'timeout'
      ? <Card><ErrorState title="No disponible ahora" body="La consulta acotada del libro económico superó el tiempo permitido. No significa que no haya datos: reintenta en un momento." onRetry={() => void load()} busy={busy} /></Card>
      : <Card><EmptyState art="inbox" title="Sin registros en el libro económico" body="Aún no hay pedidos ni reembolsos registrados en los últimos 12 meses. Carga una fuente para ver el panel financiero." action={<LinkButton href="/economics">Ir a Dinero › Preparar</LinkButton>} /></Card>}</div>;

  const block = report.perCurrency.find(c => c.currency === currency) ?? report.perCurrency[0];
  const kpis = report.kpis.find(k => k.currency === block.currency)!;
  const line = block.orderBases[0];
  const sparkDe = (id: string): number[] => {
    const lleno = (xs: {partial: boolean}[]) => xs.length;
    void lleno;
    if (id.startsWith('refund:rate') || id.includes('rate')) return block.rate.series.filter(s => !s.partial && s.bps !== null).map(s => s.bps as number);
    if (id.startsWith('refund')) return block.refunds.series.filter(s => !s.partial).map(s => Number(BigInt(s.amount)));
    if (id.includes('ticket')) return line.series.filter(s => !s.partial && s.known > 0).map(s => Number(BigInt(s.amount)) / s.known);
    if (id.includes('order') || id.includes('pedidos')) return block.ordersAll.filter(s => !s.partial).map(s => s.n);
    return line.series.filter(s => !s.partial && s.known > 0).map(s => Number(BigInt(s.amount)));
  };
  const stripKpis: Kpi[] = kpis.metrics.map(m => {
    const refund = m.id.startsWith('refund');
    const t = m.delta?.bps == null || refund ? undefined : m.delta.bps > 0 ? 'up' : m.delta.bps < 0 ? 'down' : undefined;
    return {key: m.id, label: m.label, c: refund ? 2 : 1, value: <span title={m.display}>{(m.display.length>9?m.display.replace(/\.\d+/,''):m.display).replace(/\s?(USD|CAD|MXN)$/,'')}</span>, spark: sparkDe(m.id),
      note: <span className="dg-kpi-nota">{m.delta ? <span className="dg-delta" data-t={t}>{m.delta.display}</span> : <span className="dg-delta">sin comparar</span>}<span>{m.delta ? 'vs ' + m.delta.vs : m.scope}</span></span>};
  });
  const alertas = report.alerts.filter(a => a.severity !== 'info');
  const TONO: Record<string, 'bad' | 'warn' | 'info'> = {alta: 'bad', media: 'warn', baja: 'info', info: 'info'};
  return <div className="dg-page">
    {header}
    <LineaCache edadMs={rep.edadMs} actualizando={rep.actualizando} viejo={rep.viejo} />
    <FilterBar label="Moneda y medida">
      <SegmentedControl label="Moneda" size="sm" value={block.currency} options={report.currencies.map(c => ({value: c, label: c}))} onChange={setCurrency} />
      <SegmentedControl label="Medida" size="sm" value={measure} options={MEASURES.map(m => ({value: m.value, label: m.label}))} onChange={v => setMeasure(v as Measure)} />
      <FilterSpacer />
      {ok?.synthetic && <Chip tone="warn">Datos sintéticos de demostración</Chip>}
      <Chip>{lineaDatosHasta({libro: report.watermark}).replace(/\.$/, '')}</Chip>
      <Chip categoria={1}>Último mes completo: {report.lastComplete ? monthLabel(report.lastComplete) : 'ninguno'}</Chip>
      {!report.complete && <Chip tone="warn">Resultado truncado</Chip>}
    </FilterBar>
    <Notice tone="info">USD, CAD y MXN no se suman ni se convierten: no hay tipos de cambio aprobados. Tampoco se restan reembolsos de ingresos (bases distintas). {organization ?? ''}</Notice>
    <KpiStrip items={stripKpis} label={`Indicadores de ${block.currency}`} />
    <CaidaExplicada report={report} moneda={block.currency} />
    <Fila split="8-4">
      <Card title="Tendencia mensual" description={`Últimos ${report.months.length} meses · ${block.currency}`}>
        <MonthBars key={measure + block.currency} title={seriesPoints(block, measure).title} unit={seriesPoints(block, measure).unit} points={seriesPoints(block, measure).points} note={seriesPoints(block, measure).note} exponent={seriesPoints(block, measure).exponent} c={measure === 'reembolsos' || measure === 'tasa' ? 2 : measure === 'pedidos' ? 5 : 1} height={290} />
      </Card>
      <Card title={`Alertas (${alertas.length} activas)`} description="Reglas deterministas sobre cifras observadas" actions={<KindBadge kind="observed" />}>
        {alertas.length === 0 ? <Vacio>Ninguna regla se activó con los datos actuales.</Vacio> :
          <ul className="dg-lista" aria-label="Alertas" data-cols="dos">{alertas.slice(0, 4).map(a => <li key={a.id}>
            <span className="dg-lab"><b>{a.title}</b><small>{a.detail}</small></span>
            <span style={{display: 'grid', gap: 4, justifyItems: 'end'}}><Chip tone={TONO[a.severity]}>{SEVERITY[a.severity]}</Chip>{a.cta && <LinkButton href={a.cta.href} size="sm">{a.cta.label}</LinkButton>}</span></li>)}</ul>}
      </Card>
    </Fila>
    <Fila split="6-6">
      <Mix report={report} currency={block.currency} />
      <Quality report={report} />
    </Fila>
    <Projections report={report} block={block} />
    <Exposure report={report} />
    <Comparativa block={block} />
    <Card title="Glosario y cómo leer las cifras" description={ok?.synthetic ? AFTER_SAVE : 'Las cifras provienen del libro económico de esta organización; los CSV y PDF llevan exactamente las mismas.'}>
      <dl className="cf-glossary">{report.glossary.map(g => <div key={g.term}><dt>{g.term}</dt><dd>{g.body}</dd></div>)}</dl>
    </Card>
  </div>;
}

type Row = {month: string; partial: boolean; orders: number; revenue: string; ticket: string; refunds: number; refundAmount: string; rate: string; mom: string | null};
function Comparativa({block}: {block: CurrencyBlock}) {
  const line = block.orderBases[0];
  const rows: Row[] = useMemo(() => line.series.map((s, i) => {
    const prev = i > 0 ? line.series[i - 1] : null, ref = block.refunds.series[i], rate = block.rate.series[i];
    const mom = prev && !s.partial && !prev.partial && s.known > 0 && prev.known > 0 ? signedPct(changeBps(BigInt(s.amount), BigInt(prev.amount))) : null;
    return {month: s.month, partial: s.partial, orders: s.n, revenue: s.amountDisplay, ticket: s.ticketDisplay ?? 'No disponible', refunds: ref.n, refundAmount: ref.n ? ref.amountDisplay : '—', rate: rate.display, mom};
  }).reverse(), [line, block]);
  const cols: Column<Row>[] = [
    {key: 'month', header: 'Mes', render: r => <>{monthLabel(r.month)}{r.partial && <> <Chip tone="warn">Incompleto</Chip></>}</>},
    {key: 'orders', header: 'Pedidos', align: 'num', render: r => int(r.orders)},
    {key: 'revenue', header: 'Ingresos', align: 'num', render: r => r.revenue},
    {key: 'mom', header: 'vs mes anterior', align: 'num', render: r => r.mom ?? '—'},
    {key: 'ticket', header: 'Ticket promedio', align: 'num', render: r => r.ticket},
    {key: 'refunds', header: 'Reembolsos', align: 'num', render: r => int(r.refunds)},
    {key: 'refundAmount', header: 'Importe reembolsado', align: 'num', render: r => r.refundAmount},
    {key: 'rate', header: 'Tasa', align: 'num', render: r => r.rate},
  ];
  const others = block.orderBases.slice(1);
  return <Card title="Comparativa mensual" description={`${block.currency} · la variación solo se calcula entre meses completos; «—» = no comparable o sin importe`}>
    <DataTable caption={`Comparativa mensual en ${block.currency}`} rows={rows} columns={cols} rowKey={r => r.month} maxHeight="none" />
    {others.length > 0 && <p className="dg-nota">Otras bases en {block.currency} (no se suman): {others.map(b => `${b.label} · ${b.channels.map(c => c.label).join(', ')} · ${int(b.total.n)} pedidos`).join(' | ')}.</p>}
  </Card>;
}

function Mix({report, currency}: {report: CfoReport; currency: string}) {
  const pedidos: ItemBarra[] = report.mix.orders.map(o => ({key: o.channel, label: o.label, etiqueta: o.label, sub: `${int(o.n)} pedidos`, valor: (o.shareBps ?? 0) / 100, texto: pct(o.shareBps)}));
  const grupos = report.mix.byCurrency.filter(g => g.currency === currency);
  return <Card title="Mezcla por canal" description={`Pedidos (conteo, sin moneda) e importes en ${currency} por base: no se suman entre sí`} actions={<KindBadge kind="observed" />}>
    <div className="dg-dos dg-dos-fill">
      <div><p className="dg-lab" style={{margin: '0 0 2px'}}><b>Pedidos por canal</b></p><ListaBarras c={1} max={100} label="Pedidos por canal" apilado items={pedidos} /></div>
      <div>{grupos.length === 0 ? <Vacio>Sin importes en {currency}.</Vacio> : grupos.map(g => <div key={g.currency + g.base} className="dg-g"><p className="dg-lab" style={{margin: '0 0 2px'}}><b>{g.baseLabel}</b><small>total {g.total}</small></p>
        <ListaBarras c={2} max={100} label={`${g.currency} ${g.baseLabel}`} apilado items={g.items.map(i => ({key: i.channel, etiqueta: i.label, sub: i.display, valor: (i.shareBps ?? 0) / 100, texto: pct(i.shareBps)}))} /></div>)}</div>
    </div>
    <div className="dg-pie"><HowTo text={report.mix.ordersFig.how} /></div></Card>;
}

function Quality({report}: {report: CfoReport}) {
  const q = report.quality;
  return <Card title="Calidad de datos" description="Qué tan completo está lo que ves; lo incompleto queda fuera de los totales" actions={<KindBadge kind="observed" />}>
    <div className="dg-fill">
      <ListaBarras c={5} max={100} label="Completitud por canal" items={q.byChannel.map(r => ({key: r.channel, etiqueta: r.label, sub: !r.hasRefundSource ? `${int(r.rows)} registros · sin fuente de devoluciones` : `${int(r.rows)} registros · ${int(r.noCurrency)} sin moneda · ${int(r.ordersNoAmount + r.refundsNoAmount)} sin importe`, valor: (r.completenessBps ?? 0) / 100, texto: pct(r.completenessBps)}))} />
      <ul className="dg-leyenda" style={{marginTop: 8}} aria-label="Cifras de calidad">{[q.figs.rows, q.figs.noCurrency, q.figs.ordersNoAmount, q.figs.refundsNoAmount, q.figs.toReview].map(f => <li key={f.id}><i style={{['--cat' as string]: 'var(--chart-5)'}} />{f.label}: <b>{f.display}</b></li>)}</ul>
      <p className="dg-nota">Estimado, no suma a lo observado: lo que valdrían los registros sin importe con el ticket promedio de su canal. {q.unaccounted.flatMap(u => [u.orderFig, u.refundFig]).filter(f => f.display && !f.display.startsWith('Sin')).map(f => `${f.label}: ${f.display}`).join(' · ')}</p>
    </div></Card>;
}

function Exposure({report}: {report: CfoReport}) {
  const e = report.exposure;
  return <Card title="Exposición económica por problema" description="Problemas con dinero detrás" actions={<KindBadge kind="inferred" />}>
    {e.state === 'sin_atestar' ? <div className="dg-fill"><Vacio>No disponible: falta vincular cada problema con sus pedidos (hoy hay {int(e.attestedLinks)} vínculos atestados), así que no se calcula dinero por problema ni se estima.</Vacio>{e.cta && <div style={{marginTop: 12}}><LinkButton href={e.cta.href} size="sm">{e.cta.label}</LinkButton></div>}</div> : <div className="dg-fill">
      <p className="dg-nota" style={{marginTop: 0}}>{e.note}{e.coverageComplete ? '' : ' La cobertura de vínculos no está declarada completa: son pisos, no totales.'}</p>
      <ul className="dg-lista" aria-label="Exposición por problema" data-cols="dos">{e.rows.map(r => <li key={r.problemId}><span className="dg-lab"><b>{r.title}</b><small>{int(r.linkedOrders)} pedidos vinculados ({r.coverage.known} con importe)</small></span><span className="dg-val">{r.display}</span></li>)}</ul></div>}
  </Card>;
}

function Projections({report, block}: {report: CfoReport; block: CurrencyBlock}) {
  const list = report.projections.filter(p => p.currency === block.currency);
  return <Card title="Proyección a 3 meses" description="Estimado: nunca presentado como observado" actions={<KindBadge kind="estimated" />}>
    {list.length === 0 ? <Vacio>No estimable: se necesitan al menos 4 meses completos de {block.currency}.</Vacio> : <div className="dg-dos">{list.map(p => <div key={p.id}>
      <MonthBars key={p.id} title={p.label} unit={p.metric === 'ingresos' ? p.currency : 'pedidos'} kind="estimated" points={p.points.map(pt => ({month: pt.month, value: pt.mid, label: pt.midDisplay, detail: `rango ${pt.lowDisplay} a ${pt.highDisplay}`}))} />
      <p className="dg-nota"><strong>Método.</strong> {p.method}</p></div>)}</div>}
  </Card>;
}

/** Explica una caída mes contra mes solo con lo verificable: meses completos, aporte por canal y ticket. Sin causa verificable: «Causa no determinada». */
function CaidaExplicada({report, moneda}: {report: CfoReport; moneda: string}) {
  const x = explicarVariacion(report, moneda);
  if (!x) return null;
  return <Notice tone="warn" title={x.titulo}>
    <ul style={{margin: '4px 0', paddingLeft: 18}}>{x.lineas.map((l, i) => <li key={i}>{l}</li>)}</ul>
    <strong>{x.causa.split(':')[0]}.</strong> {(r => r.charAt(0).toUpperCase() + r.slice(1))(x.causa.split(':').slice(1).join(':').trim())}</Notice>;
}
