'use client';
import {RovaqCargando} from '../rovaq-cargando';
import {useT, useIdioma} from '../i18n/proveedor';
import type {Clave} from '../../lib/i18n';
import {useCallback, useMemo} from 'react';
import {useJson} from '../ui/use-json';
import {useAcceso} from '../workspace/access';
import {LineaCache} from '../ui/linea-cache';
import {useVistaPersistente} from '../workspace/vista-persistente';
import {EsperaEsqueleto} from '../ui/wait-status';
import {Download} from '../ui/button';
import {CtlLink} from '../agente/ctl';
import {UnaKpis,PestanasUna,SegmentoUna,kpiCorto,type KpiUna,type PestanaUna} from './una-ui';
import {KindBadge} from '../ui/kind-badge';
import {Card} from '../ui/card';
import {Icon} from '../agente/icons';
import {Chip} from '../ui/chip';
import {Notice} from '../ui/notice';
import {MenuList,Popover} from '../ui/overlay';
import {ErrorState} from '../ui/error-state';
import {DataTable, type Column} from '../ui/data-table';
import {EmptyState} from '../ui/empty-state';
import {ListaBarras, Vacio, type ItemBarra} from '../dinero/partes';
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
const MEASURES: ReadonlyArray<{value: Measure; label: Clave}> = [{value: 'ingresos', label: 'cfo.med.ingresos'}, {value: 'pedidos', label: 'cfo.med.pedidos'}, {value: 'reembolsos', label: 'cfo.med.reembolsos'}, {value: 'tasa', label: 'cfo.med.tasa'}];
const SEVERITY: Record<string, Clave> = {alta: 'cfo.sev.alta', media: 'cfo.sev.media', baja: 'cfo.sev.baja', info: 'cfo.sev.info'};

const acceptReporte = (j: unknown): ReportState | null => { const d = (j as {data?: ReportState})?.data; return d && (d.status === 'ok' || d.status === 'empty' || d.status === 'timeout') ? d : null; };
const ROLES_CFO = ['owner', 'analyst'];
/** Informe clásico de CFO (se abre desde el copiloto con «Ver detalle» / «Ver informe completo»: /cfo?vista=informe). */
export function CfoDashboard({query = '', organization, roleOverride, volverA = '/cfo'}: {query?: string; organization?: string; roleOverride?: string; volverA?: string}) {
  const {role} = useAcceso();
  const t = useT(), idioma = useIdioma();
  // Caché stale-while-revalidate (swr.mjs): al volver al panel se pinta al instante el último informe, rotulado, y se revalida sin vaciar la pantalla.
  const permitido = ROLES_CFO.includes(roleOverride ?? role);
  const rep = useJson<ReportState>(permitido ? '/cfo/data/report' + query : null, acceptReporte);
  const [pick, setPick] = useVistaPersistente<string>('cfo:moneda', ''), [measure, setMeasure] = useVistaPersistente<Measure>('cfo:medida', 'ingresos');
  const state = rep.data, busy = rep.busy, error = rep.error;
  const currency = state?.status === 'ok' ? (state.report.currencies.includes(pick) ? pick : state.report.currencies[0]) : pick, setCurrency = setPick;
  const load = useCallback(async () => { await rep.reload(); }, [rep]);
  const ok = state?.status === 'ok' ? state : null, report = ok?.report;
  const actions = <>
    <Popover label={t('cfo.exportar')} align="end" width={220} triggerClassName="ctl ctl-solo" trigger={<><Download /><span className="ctl-label una-solo-vis">{t('cfo.exportar')}</span><span className="sr-only una-solo-sr">{t('cfo.exportar')}</span></>}>
      <MenuList>
        <li><CtlLink href="/cfo/data/export?format=csv" download="informe-cfo.csv" icon={<Download />}>{t('cfo.csv')}</CtlLink></li>
        <li><CtlLink href="/cfo/data/export?format=pdf" download="informe-cfo.pdf" icon={<Download />}>{t('cfo.pdf')}</CtlLink></li></MenuList></Popover>
  </>;
  const header = <header className="una-head"><CtlLink href={volverA} variant="soft" solo icon={<Icon name="back" size={16} />}>{t('cfo.volverChat')}</CtlLink><div className="una-head-t"><p className="eyebrow">{t('cfo.eyebrow')}</p><h1 className="una-h1">{t('cfo.titulo')}</h1></div><p className="una-head-d">{t('cfo.desc')}</p><div className="una-head-a">{actions}</div></header>;
  if (!permitido) return <div className="dg-page una-informe"><header className="una-head"><div className="una-head-t"><p className="eyebrow">{t('cfo.eyebrow')}</p><h1 className="una-h1">{t('cfo.titulo')}</h1></div></header>
    <Card><EmptyState art="shield" title={t('cfo.sinAccesoTitulo')} body={t('cfo.sinAccesoCuerpo')} action={<CtlLink href="/overview" variant="soft">{t('cfo.volverResumen')}</CtlLink>} /></Card></div>;
  if (!state && busy && !error) return <RovaqCargando mensaje="" />;
  if (!report) return <div className="dg-page una-informe">{header}{error && <ErrorState title={t('cfo.noDisponible')} body={error} onRetry={() => void load()} />}
    {!state ? (busy ? <EsperaEsqueleto que={t('cfo.esperaInforme')} filas={5} /> : null)
    : state.status === 'timeout'
      ? <Card><ErrorState title={t('cfo.noDisponible')} body={t('cfo.timeout')} onRetry={() => void load()} busy={busy} /></Card>
      : <Card><EmptyState art="inbox" title={t('cfo.vacioTitulo')} body={t('cfo.vacioCuerpo')} action={<CtlLink href="/economics" variant="soft">{t('cfo.irPreparar')}</CtlLink>} /></Card>}</div>;

  const block = report.perCurrency.find(c => c.currency === currency) ?? report.perCurrency[0];
  const kpis = report.kpis.find(k => k.currency === block.currency)!;
  const kpisUna: KpiUna[] = kpis.metrics.map(m => {
    const refund = m.id.startsWith('refund');
    const tr = m.delta?.bps == null || refund ? undefined : m.delta.bps > 0 ? 'up' : m.delta.bps < 0 ? 'down' : undefined;
    return {key: m.id, label: m.label, c: refund ? 2 : 1, value: kpiCorto(m.display), title: m.display, delta: m.delta ? m.delta.display : null, t: tr, sub: (m.delta ? t('cfo.vs', {vs: m.delta.vs}) : m.scope) ?? undefined};
  });
  const alertas = report.alerts.filter(a => a.severity !== 'info');
  const TONO: Record<string, 'bad' | 'warn' | 'info'> = {alta: 'bad', media: 'warn', baja: 'info', info: 'info'};
  const serie = seriesPoints(block, measure, t, idioma);
  const tabs: PestanaUna[] = [
    {id: 'tendencia', label: t('cfo.tab.tendencia'), llena: true, contenido: <MonthBars llena key={measure + block.currency} title={serie.title} unit={serie.unit} points={serie.points} note={serie.note} exponent={serie.exponent} c={measure === 'reembolsos' || measure === 'tasa' ? 2 : measure === 'pedidos' ? 5 : 1} />},
    {id: 'alertas', label: t('cfo.tab.alertas'), count: alertas.length, contenido: <>
      <CaidaExplicada report={report} moneda={block.currency} />
      {alertas.length === 0 ? <Vacio>{t('cfo.sinAlertas')}</Vacio> :
        <ul className="dg-lista" aria-label={t('cfo.alertas')} data-cols="dos">{alertas.slice(0, 8).map(a => <li key={a.id}>
          <span className="dg-lab"><b>{a.title}</b><small>{a.detail}</small></span>
          <span style={{display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap'}}><Chip tone={TONO[a.severity]}>{t(SEVERITY[a.severity])}</Chip>{a.cta && <CtlLink href={a.cta.href}>{a.cta.label}</CtlLink>}</span></li>)}</ul>}</>},
    {id: 'canales', label: t('cfo.tab.canales'), contenido: <Mix report={report} currency={block.currency} />},
    {id: 'calidad', label: t('cfo.tab.calidad'), contenido: <Quality report={report} />},
    {id: 'proyeccion', label: t('cfo.tab.proyeccion'), contenido: <Projections report={report} block={block} />},
    {id: 'exposicion', label: t('cfo.tab.exposicion'), contenido: <Exposure report={report} />},
    {id: 'comparativa', label: t('cfo.tab.comparativa'), contenido: <Comparativa block={block} />},
    {id: 'glosario', label: t('cfo.tab.glosario'), contenido: <>
      <p className="dg-nota" style={{margin: '0 0 10px'}}>{lineaDatosHasta({libro: report.watermark})} {t('cfo.ultimoMes', {mes: report.lastComplete ? monthLabel(report.lastComplete, idioma) : t('cfo.ninguno')})}</p>
      <p className="dg-nota" style={{margin: '0 0 10px'}}>{t('cfo.monedas')} {organization ?? ''}</p>
      <p className="dg-nota" style={{margin: '0 0 10px'}}>{ok?.synthetic ? t('cfo.sintetico') : t('cfo.origenReal')}</p>
      <dl className="cf-glossary">{report.glossary.map(g => <div key={g.term}><dt>{g.term}</dt><dd>{g.body}</dd></div>)}</dl></>},
  ];
  return <div className="dg-page una-informe">
    {header}
    <div className="una-filtros" role="group" aria-label={t('cfo.monedaMedida')}>
      <SegmentoUna label={t('cfo.moneda')} value={block.currency} options={report.currencies.map(c => ({value: c, label: c}))} onChange={setCurrency} />
      <SegmentoUna label={t('cfo.medida')} value={measure} options={MEASURES.map(m => ({value: m.value, label: t(m.label)}))} onChange={v => setMeasure(v as Measure)} />
      <span className="una-filtros-chips">
        {ok?.synthetic && <Chip tone="warn">{t('cfo.chipSintetico')}</Chip>}
        <Chip>{lineaDatosHasta({libro: report.watermark}).replace(/\.$/, '')}</Chip>
        {!report.complete && <Chip tone="warn">{t('cfo.truncado')}</Chip>}
      </span>
    </div>
    <p className="una-nota"><Icon name="info" size={14} /><span className="una-nota-t">{t('cfo.ultimoMes', {mes: report.lastComplete ? monthLabel(report.lastComplete, idioma) : t('cfo.ninguno')})} {t('cfo.monedas')} {organization ?? ''}</span></p>
    <LineaCache edadMs={rep.edadMs} actualizando={rep.actualizando} viejo={rep.viejo} />
    <UnaKpis items={kpisUna} label={t('cfo.indicadoresDe', {moneda: block.currency})} />
    <PestanasUna items={tabs} etiqueta={t('cfo.secciones')} anclas={{tendencias: 'tendencia', alertas: 'alertas', mezcla: 'canales', calidad: 'calidad', proyecciones: 'proyeccion', exposicion: 'exposicion', comparativa: 'comparativa', glosario: 'glosario'}} />
  </div>;
}

type Row = {month: string; partial: boolean; orders: number; revenue: string; ticket: string; refunds: number; refundAmount: string; rate: string; mom: string | null};
function Comparativa({block}: {block: CurrencyBlock}) {
  const t = useT(), idioma = useIdioma();
  const line = block.orderBases[0];
  const rows: Row[] = useMemo(() => line.series.map((s, i) => {
    const prev = i > 0 ? line.series[i - 1] : null, ref = block.refunds.series[i], rate = block.rate.series[i];
    const mom = prev && !s.partial && !prev.partial && s.known > 0 && prev.known > 0 ? signedPct(changeBps(BigInt(s.amount), BigInt(prev.amount))) : null;
    return {month: s.month, partial: s.partial, orders: s.n, revenue: s.amountDisplay, ticket: s.ticketDisplay ?? t('cfo.noDisponible'), refunds: ref.n, refundAmount: ref.n ? ref.amountDisplay : '—', rate: rate.display, mom};
  }).reverse(), [line, block, t]);
  const cols: Column<Row>[] = [
    {key: 'month', header: t('cfo.comp.mes'), render: r => <>{monthLabel(r.month, idioma)}{r.partial && <> <Chip tone="warn">{t('cfo.comp.incompleto')}</Chip></>}</>},
    {key: 'orders', header: t('cfo.comp.pedidos'), align: 'num', render: r => int(r.orders, idioma)},
    {key: 'revenue', header: t('cfo.comp.ingresos'), align: 'num', render: r => r.revenue},
    {key: 'mom', header: t('cfo.comp.vsAnterior'), align: 'num', render: r => r.mom ?? '—'},
    {key: 'ticket', header: t('cfo.comp.ticket'), align: 'num', render: r => r.ticket},
    {key: 'refunds', header: t('cfo.comp.reembolsos'), align: 'num', render: r => int(r.refunds, idioma)},
    {key: 'refundAmount', header: t('cfo.comp.importeReemb'), align: 'num', render: r => r.refundAmount},
    {key: 'rate', header: t('cfo.comp.tasa'), align: 'num', render: r => r.rate},
  ];
  const others = block.orderBases.slice(1);
  return <Card title={t('cfo.comp.titulo')} description={t('cfo.comp.desc', {moneda: block.currency})}>
    <DataTable caption={t('cfo.comp.caption', {moneda: block.currency})} rows={rows} columns={cols} rowKey={r => r.month} maxHeight="none" />
    {others.length > 0 && <p className="dg-nota">{t('cfo.comp.otras', {moneda: block.currency, lista: others.map(b => `${b.label} · ${b.channels.map(c => c.label).join(', ')} · ${t('cfo.comp.nPedidos', {n: int(b.total.n, idioma)})}`).join(' | ')})}</p>}
  </Card>;
}

function Mix({report, currency}: {report: CfoReport; currency: string}) {
  const t = useT(), idioma = useIdioma();
  const pedidos: ItemBarra[] = report.mix.orders.map(o => ({key: o.channel, integracion: o.channel, label: o.label, etiqueta: o.label, sub: t('cfo.comp.nPedidos', {n: int(o.n, idioma)}), valor: (o.shareBps ?? 0) / 100, texto: pct(o.shareBps, idioma)}));
  const grupos = report.mix.byCurrency.filter(g => g.currency === currency);
  return <Card title={t('cfo.mix.titulo')} description={t('cfo.mix.desc', {moneda: currency})} actions={<KindBadge kind="observed" />}>
    <div className="dg-dos dg-dos-fill">
      <div><p className="dg-lab" style={{margin: '0 0 2px'}}><b>{t('cfo.mix.pedidosCanal')}</b></p><ListaBarras c={1} max={100} label={t('cfo.mix.pedidosCanal')} apilado items={pedidos} /></div>
      <div>{grupos.length === 0 ? <Vacio>{t('cfo.mix.sinImportes', {moneda: currency})}</Vacio> : grupos.map(g => <div key={g.currency + g.base} className="dg-g"><p className="dg-lab" style={{margin: '0 0 2px'}}><b>{g.baseLabel}</b><small>{t('cfo.mix.total', {total: g.total})}</small></p>
        <ListaBarras c={2} max={100} label={`${g.currency} ${g.baseLabel}`} apilado items={g.items.map(i => ({key: i.channel, integracion: i.channel, etiqueta: i.label, sub: i.display, valor: (i.shareBps ?? 0) / 100, texto: pct(i.shareBps, idioma)}))} /></div>)}</div>
    </div>
    <div className="dg-pie"><HowTo text={report.mix.ordersFig.how} /></div></Card>;
}

function Quality({report}: {report: CfoReport}) {
  const t = useT(), idioma = useIdioma(), q = report.quality;
  return <Card title={t('cfo.cal.titulo')} description={t('cfo.cal.desc')} actions={<KindBadge kind="observed" />}>
    <div className="dg-fill">
      <ListaBarras c={5} max={100} label={t('cfo.cal.completitud')} items={q.byChannel.map(r => ({key: r.channel, integracion: r.channel, etiqueta: r.label, sub: !r.hasRefundSource ? t('cfo.cal.sinFuente', {n: int(r.rows, idioma)}) : t('cfo.cal.detalle', {n: int(r.rows, idioma), sinMoneda: int(r.noCurrency, idioma), sinImporte: int(r.ordersNoAmount + r.refundsNoAmount, idioma)}), valor: (r.completenessBps ?? 0) / 100, texto: pct(r.completenessBps, idioma)}))} />
      <ul className="dg-leyenda" style={{marginTop: 8}} aria-label={t('cfo.cal.cifras')}>{[q.figs.rows, q.figs.noCurrency, q.figs.ordersNoAmount, q.figs.refundsNoAmount, q.figs.toReview].map(f => <li key={f.id}><i style={{['--cat' as string]: 'var(--chart-5)'}} />{f.label}: <b>{f.display}</b></li>)}</ul>
      <p className="dg-nota">{t('cfo.cal.estimado')} {q.unaccounted.flatMap(u => [u.orderFig, u.refundFig]).filter(f => f.display && !f.display.startsWith('Sin')).map(f => `${f.label}: ${f.display}`).join(' · ')}</p>
    </div></Card>;
}

function Exposure({report}: {report: CfoReport}) {
  const t = useT(), idioma = useIdioma(), e = report.exposure;
  return <Card title={t('cfo.exp.titulo')} description={t('cfo.exp.desc')} actions={<KindBadge kind="inferred" />}>
    {e.state === 'sin_atestar' ? <div className="dg-fill"><Vacio>{t('cfo.exp.sinAtestar', {n: int(e.attestedLinks, idioma)})}</Vacio>{e.cta && <div style={{marginTop: 12}}><CtlLink href={e.cta.href}>{e.cta.label}</CtlLink></div>}</div> : <div className="dg-fill">
      <p className="dg-nota" style={{marginTop: 0}}>{e.note}{e.coverageComplete ? '' : t('cfo.exp.pisos')}</p>
      <ul className="dg-lista" aria-label={t('cfo.exp.lista')} data-cols="dos">{e.rows.map(r => <li key={r.problemId}><span className="dg-lab"><b>{r.title}</b><small>{t('cfo.exp.vinculados', {n: int(r.linkedOrders, idioma), k: r.coverage.known ?? '—'})}</small></span><span className="dg-val">{r.display}</span></li>)}</ul></div>}
  </Card>;
}

function Projections({report, block}: {report: CfoReport; block: CurrencyBlock}) {
  const t = useT();
  const list = report.projections.filter(p => p.currency === block.currency);
  return <Card title={t('cfo.pro.titulo')} description={t('cfo.pro.desc')} actions={<KindBadge kind="estimated" />}>
    {list.length === 0 ? <Vacio>{t('cfo.pro.sinEstimar', {moneda: block.currency})}</Vacio> : <div className="dg-dos">{list.map(p => <div key={p.id}>
      <MonthBars key={p.id} title={p.label} unit={p.metric === 'ingresos' ? p.currency : t('cfo.pro.unidadPedidos')} kind="estimated" points={p.points.map(pt => ({month: pt.month, value: pt.mid, label: pt.midDisplay, detail: t('cfo.pro.rango', {bajo: pt.lowDisplay, alto: pt.highDisplay})}))} />
      <p className="dg-nota"><strong>{t('cfo.pro.metodo')}</strong> {p.method}</p></div>)}</div>}
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
