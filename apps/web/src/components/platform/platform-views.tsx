'use client';
import {useAutoRefresh} from '../ui/use-auto-refresh';
/* eslint-disable @typescript-eslint/no-explicit-any -- la vista de plataforma es JSON agregado de contrato abierto (platform_observe); los campos se validan en el modelo puro */
import {useSearchParams} from 'next/navigation';
import {useLayoutEffect,useCallback, useMemo, useRef, useState, type FormEvent, type ReactNode} from 'react';
import {PageHeader} from '../ui/page-header';
import {Button, LinkButton, Refresh, Download} from '../ui/button';
import {KindBadge} from '../ui/kind-badge';
import {Modal} from '../ui/overlay';
import {IdChip} from '../ui/id-chip';
import {BarChart, type BarDatum} from '../ui/bar-chart';
import {TeamPanel} from '../team-panel';
import {CopilotPanel, type Shortcuts} from './copilot-panel';
import {BulkBar, DataTable, downloadCsv, type Column} from './data-table';
import {PfIcon} from './icons';
import {Empty, HowTo, Meter, Panel, Pill, Seg, Tile, healthTone, severityTone, Skeleton} from './primitives';
import {EXPECTED_SOURCES, HEALTH, PLATFORM_SHORTCUTS} from '../../../../../packages/cfo-copilot/src/client.mjs';
import type {PlatformView} from '../../../../../packages/cfo-copilot/src/index.mjs';
import {int as intF, pct as pctF} from '../../../../../packages/cfo-copilot/src/format.mjs';
import {useIdioma, useT} from '../i18n/proveedor';
import {fecha} from '../../lib/i18n/formato';
import {traductor, type Clave, type Idioma, type Traductor} from '../../lib/i18n';
import {OP_KEY, VENTANA_DIAS} from '../../lib/platform/ficha-model';
import './platform-ui.css';

type Org = PlatformView['organizations'][number];
export type PlatformStateClient =
  | {status: 'ok'; view: PlatformView; synthetic: boolean}
  | {status: 'partial'; reason: string; reasonCode?: 'missing' | 'failed'; organizations: Array<{id: string; name: string; createdAt: string}>; audit: Array<{id: string; actorId: string; operation: string; tenantId: string | null; createdAt: string}>}
  | {status: 'denied' | 'error'};
type Props = {initial: PlatformStateClient};
/** Formato por idioma activo: fechas en UTC, enteros y porcentajes con el locale del idioma, y el traductor. */
function useFmt() {
  const idioma = useIdioma(), t = useT();
  return useMemo(() => ({idioma, t,
    int: (n: number | null | undefined) => intF(n, idioma), pct: (bps: number | null | undefined) => pctF(bps, idioma),
    fmtDate: (iso: string | null) => (iso ? fecha(idioma, iso, {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}) + ' UTC' : t('tr.pl.sinRegistro')),
    dia: (iso: string) => fecha(idioma, iso)}), [idioma, t]);
}
const OPERATION_KEY: Record<string, Clave> = {...OP_KEY, org_view: 'tr.pl.opFichaConsultada'};
const opLabel = (op: string, t: Traductor) => (OPERATION_KEY[op] ? t(OPERATION_KEY[op]) : op);
const HEALTH_KEY: Record<string, Clave> = {healthy: 'tr.pl.saludable', attention: 'tr.pl.requiereAtencion', critical: 'tr.pl.critica'};
const SEVERITY_KEY: Record<string, Clave> = {alta: 'tr.pl.sevAlta', media: 'tr.pl.sevMedia', baja: 'tr.pl.sevBaja', info: 'tr.pl.sevInfo'};
const SOURCE_KEY: Record<string, Clave> = {hubspot: 'tr.pl.srcHubspot', associations: 'tr.pl.srcAsociaciones', csv: 'tr.pl.srcCsv', ledger: 'tr.pl.srcLedger', excel: 'tr.pl.srcExcel', attachments: 'tr.pl.srcAdjuntos', zendesk: 'tr.pl.srcZendesk'};
const healthLabel = (level: string, t: Traductor) => (HEALTH_KEY[level] ? t(HEALTH_KEY[level]) : level);
const severityLabel = (sev: string, t: Traductor) => (SEVERITY_KEY[sev] ? t(SEVERITY_KEY[sev]) : sev);
const sourceName = (key: string, fallback: string, t: Traductor) => (SOURCE_KEY[key] ? t(SOURCE_KEY[key]) : fallback);
const REASON_KEY: Record<string, Clave> = {missing: 'tr.pl.razonFalta', failed: 'tr.pl.razonFallo'};
/** Texto del motivo de la vista parcial: el servidor manda un código; sin código (versión anterior) se muestra el texto recibido. */
const partialReason = (state: {reason: string; reasonCode?: string}, t: Traductor) => (state.reasonCode && REASON_KEY[state.reasonCode] ? t(REASON_KEY[state.reasonCode]) : state.reason);
/** Atajos del copiloto en el idioma activo; la clave de `direct` sigue a la pregunta traducida. Sin traducción conocida, el texto pasa tal cual. */
const QUESTION_KEY: Record<string, Clave> = {'¿Qué organizaciones requieren atención?': 'tr.pl.q1', '¿Hay procesos fallidos?': 'tr.pl.q2', '¿Cómo va el gasto de IA contra el tope?': 'tr.pl.q3', '¿Qué alertas operativas hay?': 'tr.pl.q4', '¿Qué fuentes faltan por cargar?': 'tr.pl.q5', '¿Cómo está la cobertura de fuentes?': 'tr.pl.q6', '¿Qué se hizo últimamente en la bitácora?': 'tr.pl.q7'};
const CATEGORY_KEY: Record<string, Clave> = {Organizaciones: 'tr.pl.organizaciones', Operación: 'tr.pl.operacion', Costos: 'tr.pl.costos'};
function localizarAtajos(base: Shortcuts, t: Traductor): Shortcuts {
  const q = (x: string) => (QUESTION_KEY[x] ? t(QUESTION_KEY[x]) : x);
  return {suggestions: base.suggestions.map(q), categories: base.categories.map(c => ({title: CATEGORY_KEY[c.title] ? t(CATEGORY_KEY[c.title]) : c.title, questions: c.questions.map(q)})),
    direct: Object.fromEntries(Object.entries(base.direct).map(([k, v]) => [q(k), v]))};
}
// Textos que arma el modelo del servidor (paquete cfo-copilot, que no se edita aquí): se reconocen por su plantilla en español y se muestran en el idioma activo; lo desconocido pasa tal cual.
const ES_FIJO = traductor('es'), escapar = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TEXTOS_EXACTOS = new Map<string, Clave>((['tr.pl.opsStTitulo', 'tr.pl.opsStDetalle', 'tr.pl.opsCronTitulo', 'tr.pl.opsCronDetalle', 'tr.pl.opsDiscoTitulo', 'tr.pl.opsDiscoDetalle', 'tr.pl.rzTopeAgotado', 'tr.pl.rzSinActRegistro', 'tr.pl.sinFuenteConectada'] as Clave[]).map(k => [ES_FIJO(k), k]));
const PLANTILLAS = (['tr.pl.rzAtascados', 'tr.pl.rzFallidos', 'tr.pl.rzImport', 'tr.pl.rzGastoAl', 'tr.pl.rzReservas', 'tr.pl.rzSinActividad', 'tr.pl.rzInvVencidas'] as Clave[]).map(k => {
  const base = ES_FIJO(k), [antes, despues] = base.split(/\{\w+\}/);
  return {k, variable: base.match(/\{(\w+)\}/)![1], re: new RegExp('^' + escapar(antes) + '(.+?)' + escapar(despues) + '$')};
});
function textoServidor(texto: string | null | undefined, t: Traductor, idioma: Idioma): string {
  if (!texto) return texto ?? '';
  const exacto = TEXTOS_EXACTOS.get(texto); if (exacto) return t(exacto);
  for (const p of PLANTILLAS) { const m = p.re.exec(texto); if (m) return t(p.k, {[p.variable]: p.variable === 'pct' && idioma === 'en' ? m[1].replace(/\s%$/, '%') : m[1]}); }
  return texto;
}
const MIN_MOTIVO = 10, UMBRAL_IA = 80;
/** Fecha del cierre de mes para el texto del cálculo de la proyección (UTC), igual que el modelo del servidor. */
const diasDelMes = (iso: string) => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? {day: d.getUTCDate(), dim: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()} : null; };
const proyeccionHow = (generatedAt: string, fallback: string, t: Traductor) => { const m = diasDelMes(generatedAt); return m ? t('tr.pl.howProy', m) : fallback; };

function usePlatform(initial: PlatformStateClient) {
  const t = useT();
  const [state, setState] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const reload = useCallback(async () => {
    setBusy(true); setError('');
    try { const r = await fetch('/platform/data/view', {cache: 'no-store', signal: AbortSignal.timeout(20000)}); const j = await r.json(); if (!r.ok) throw new Error(); setState(j.data); }
    catch { setError(t('tr.pl.errActualizar')); } finally { setBusy(false); }
  }, [t]);
  // Datos nuevos: relectura en segundo plano (conserva las cifras pintadas); no corre si ya hay una lectura en curso.
  const busyRef = useRef(false); useLayoutEffect(()=>{busyRef.current = busy;});
  useAutoRefresh(reload, {ocupado: () => busyRef.current});
  return {state, busy, error, reload};
}
function Shell({title, description, eyebrow, ctl, extra, children, state}: {title: string; description: string; eyebrow?: string; ctl: ReturnType<typeof usePlatform>; extra?: ReactNode; children: (view: PlatformView) => ReactNode; state: PlatformStateClient}) {
  const {t, fmtDate} = useFmt(), atajos = useMemo(() => localizarAtajos(PLATFORM_SHORTCUTS as unknown as Shortcuts, t), [t]);
  const actions = <>
    <CopilotPanel endpoint="/platform/data/copilot" title={t('tr.pl.copTitulo')} subtitle={t('tr.pl.copSub')} placeholder={t('tr.pl.copPlaceholder')} shortcuts={atajos} openLabel={t('tr.pl.copiloto')} context={t('tr.pl.copContexto')} />
    {extra}</>;
  return <div className="pf-page">
    <PageHeader eyebrow={eyebrow ?? t('tr.pl.consola')} title={title} description={description} actions={actions} />
    <div className="pf-banner" role="note"><PfIcon name="shield" /><p><strong>{t('tr.pl.bannerTitulo')}</strong> {t('tr.pl.bannerTexto')}</p></div>
    {ctl.error && <p className="state state-error" role="alert">{ctl.error}</p>}
    {state.status === 'ok' && state.synthetic && <p className="pf-statusbar"><Pill tone="warn">{t('tr.pl.sinteticos')}</Pill><span>{t('tr.pl.generado', {fecha: fmtDate(state.view.generatedAt)})}</span></p>}
    {state.status === 'ok' ? children(state.view)
      : state.status === 'partial' ? <Empty title={t('tr.pl.obsNoConectada')} tone="muted">{partialReason(state, t)} {t('tr.pl.consultaApartado')}</Empty>
      : state.status === 'denied' ? <Empty tone="bad" title={t('tr.pl.sinAccesoTitulo')}>{t('tr.pf.sinAcceso')}</Empty>
      : <Empty tone="bad" title={t('tr.pl.noDisponible')} action={<Button icon={<Refresh />} onClick={() => void ctl.reload()}>{t('tr.pl.reintentar')}</Button>}>{t('tr.pl.noLeerPlat')}</Empty>}
  </div>;
}
function HealthPill({o}: {o: Org}) { const {t, idioma} = useFmt(); return <Pill tone={healthTone(o.health.level)} title={o.health.reasons.map((r: {text: string}) => textoServidor(r.text, t, idioma)).join('; ')}>{healthLabel(o.health.level, t)}</Pill>; }

// ---------------------------------------------------------------------------------------------- Resumen
export function Overview({initial}: Props) {
  const ctl = usePlatform(initial), {t, idioma, int, pct, fmtDate} = useFmt();
  return <Shell state={ctl.state} ctl={ctl} title={t('tr.pl.ovTitulo')} description={t('tr.pl.ovDesc')}
    extra={ctl.state.status === 'ok' ? <Button icon={<Download />} onClick={() => { const v = (ctl.state as {view: PlatformView}).view; downloadCsv('plataforma-organizaciones.csv', [t('tr.pl.organizacion'), t('tr.pl.salud'), t('tr.pl.miembros'), t('tr.pl.asientos'), t('tr.pl.fuentesCargadas'), t('tr.pl.procesosFallidos'), t('tr.pl.gastoIa'), t('tr.pl.topeIa')], v.organizations.map(o => [o.name, healthLabel(o.health.level, t), o.members.total, o.ledger.rows, `${o.sourcesLoaded}/${o.sourcesExpected}`, o.jobs.failed, o.aiSpent, o.aiLimit])); }}>{t('tr.pl.exportarCsv')}</Button> : null}>
    {v => {
      const k = v.kpis, attention = v.organizations.filter(o => o.health.level !== 'healthy'), ai: BarDatum[] = v.aiCosts.filter(c => c.pctBps !== null).slice(0, 5).map(c => ({key: c.id, label: c.name, value: c.pctBps ?? 0, display: `${c.spent} · ${pct(c.pctBps)}`, kind: 'observed' as const}));
      const loaded = v.organizations.reduce((a, o) => a + o.sourcesLoaded, 0), expected = v.organizations.length * EXPECTED_SOURCES.length;
      return <>
        <div className="pf-tiles pf-tiles-6 reveal">
          <Tile label={t('tr.pl.organizaciones')} value={int(k.organizations)} kind="observed" foot={t('tr.pl.ovFootOrgs', {healthy: k.healthy, attention: k.attention, critical: k.critical})} />
          <Tile label={t('tr.pl.alertasAbiertas')} value={int(k.openAlerts)} kind="observed" foot={t('tr.pl.alertasFoot')} />
          <Tile label={t('tr.pl.procesosFallidos')} value={int(k.failedJobs)} kind="observed" foot={t('tr.pl.procFoot', {stuck: k.stuckJobs, queued: k.queued, running: k.running})} />
          <Tile label={t('tr.pl.asientosLedger')} value={int(k.ledgerRows)} kind="observed" foot={t('tr.pl.todasOrgs')} />
          <Tile label={t('tr.pl.gastoIaMes')} value={k.aiSpent} kind="observed" foot={t('tr.pl.gastoFoot', {limit: k.aiLimit, pct: pct(k.aiPctBps)})}><Meter bps={k.aiPctBps} /></Tile>
          <Tile label={t('tr.pl.fuentesCargadas')} value={t('tr.pl.nDeTotal', {n: loaded, total: expected})} kind="observed" foot={t('tr.pl.paresFoot')} coverage={t('tr.pl.deCobertura', {pct: pct(Math.round(loaded * 10000 / Math.max(1, expected)))})} />
        </div>
        <div className="pf-grid-2">
          <Panel eyebrow={t('tr.pl.requierenAtencion')} title={t('tr.pl.orgsN', {n: attention.length})} actions={<LinkButton href="/platform/organizaciones" size="sm">{t('tr.pl.verTodas')}</LinkButton>}>
            {attention.length === 0 ? <Empty title={t('tr.pl.todoEnOrden')}>{t('tr.pl.ningunaMotivos')}</Empty> : <ul className="pf-list">{attention.map(o => <li key={o.id}><div className="pf-li-main"><div className="pf-li-head"><strong>{o.name}</strong><HealthPill o={o} /></div><span>{o.health.reasons.filter((r: {level: string}) => r.level !== 'info').map((r: {text: string}) => textoServidor(r.text, t, idioma)).join(' · ')}</span></div><LinkButton href={`/platform/organizaciones?org=${o.id}`} size="sm" icon={<PfIcon name="chevron" size={14} />}>{t('tr.pl.verDetalle')}</LinkButton></li>)}</ul>}
          </Panel>
          <Panel eyebrow={t('tr.pl.operacion')} title={t('tr.pl.alertasRecientes')} actions={<LinkButton href="/platform/alertas" size="sm">{t('tr.pl.verTodas')}</LinkButton>}>
            <ul className="pf-list">{v.alerts.slice(0, 5).map(a => <li key={a.id}><div className="pf-li-main"><div className="pf-li-head"><Pill tone={severityTone(a.severity)}>{severityLabel(a.severity, t)}</Pill></div><strong>{textoServidor(a.title, t, idioma)}</strong><span>{a.organization ?? textoServidor(a.detail, t, idioma)}</span></div></li>)}</ul>
          </Panel>
        </div>
        <div className="pf-grid-2">
          <Panel eyebrow={t('tr.pl.costos')} title={t('tr.pl.gastoContraTope')} actions={<LinkButton href="/platform/costos-ia" size="sm">{t('tr.pl.verDetalle')}</LinkButton>}>{ai.length ? <BarChart title={t('tr.pl.topUso')} unit={t('tr.pl.pctDelTope')} data={ai} /> : <Empty title={t('tr.pl.sinTopes')} />}</Panel>
          <Panel eyebrow={t('tr.pl.trazabilidad')} title={t('tr.pl.actividadReciente')} actions={<LinkButton href="/platform/auditoria" size="sm">{t('tr.pl.verBitacora')}</LinkButton>}>
            <ul className="pf-list">{v.audit.slice(0, 4).map(a => <li key={a.id}><div className="pf-li-main"><strong>{opLabel(a.operation, t)}</strong><span>{fmtDate(a.createdAt)} · {v.organizations.find(o => o.id === a.tenantId)?.name ?? t('tr.pf.plataforma')}</span></div></li>)}</ul>
          </Panel>
        </div>
      </>;
    }}
  </Shell>;
}

// ---------------------------------------------------------------------------------------------- Organizaciones
export function Organizations({initial}: Props) {
  const ctl = usePlatform(initial), {t, idioma, int, dia} = useFmt(), [q, setQ] = useState(''), [health, setHealth] = useState('all'), [sel, setSel] = useState<Set<string>>(new Set()), [team, setTeam] = useState<string | null>(null);
  const params = useSearchParams(), [focus, setFocus] = useState<string | null>(params.get('org'));
  if (ctl.state.status === 'partial') return <Shell state={{status: 'ok', synthetic: false, view: {organizations: [], alerts: [], audit: [], aiCosts: [], sources: [], opsSignals: [], jobs: {totals: {}, failed: []}, counts: {healthy: 0, attention: 0, critical: 0}, kpis: {}, generatedAt: new Date().toISOString()}}} ctl={ctl} title={t('tr.pl.organizaciones')} description={t('tr.pl.orgsDescParcial')}>{() => <PartialOrgs state={ctl.state as Extract<PlatformStateClient, {status: 'partial'}>} />}</Shell>;
  return <Shell state={ctl.state} ctl={ctl} title={t('tr.pl.organizaciones')} description={t('tr.pl.orgsDesc')}>
    {v => {
      const rows = v.organizations.filter(o => (health === 'all' || o.health.level === health) && (!q || o.name.toLowerCase().includes(q.toLowerCase())));
      const cols: Column<Org>[] = [
        {id: 'name', header: t('tr.pl.organizacion'), wrap: true, sort: o => o.name, cell: o => <><strong>{o.name}</strong><small className="pf-sub">{t('tr.pl.creadaActividad', {creada: dia(o.createdAt), actividad: o.lastActivityAt ? dia(o.lastActivityAt) : t('tr.pl.sinRegistroMin')})}</small></>},
        {id: 'health', header: t('tr.pl.salud'), sort: o => ({critical: 0, attention: 1, healthy: 2} as Record<string, number>)[o.health.level], cell: o => <HealthPill o={o} />},
        {id: 'members', header: t('tr.pl.miembros'), align: 'right', sort: o => o.members.total, cell: o => <>{int(o.members.total)}{o.invitationsPending > 0 && <small className="pf-sub">{t(o.invitationsPending === 1 ? 'tr.pl.invitacion1' : 'tr.pl.invitacionN', {n: o.invitationsPending})}</small>}</>},
        {id: 'ledger', header: t('tr.pl.asientos'), align: 'right', sort: o => o.ledger.rows, cell: o => int(o.ledger.rows)},
        {id: 'src', header: t('tr.pl.fuentes'), align: 'right', sort: o => o.sourcesLoaded, cell: o => t('tr.pl.nDeTotal', {n: o.sourcesLoaded, total: o.sourcesExpected})},
        {id: 'jobs', header: t('tr.pl.fallidos'), align: 'right', sort: o => o.jobs.failed, cell: o => int(o.jobs.failed)},
        {id: 'ai', header: t('tr.pl.ia'), sort: o => o.aiPctBps, cell: o => <><Meter bps={o.aiPctBps} /><small className="pf-sub">{t('tr.pl.gastoDeLimite', {spent: o.aiSpent, limit: o.aiLimit})}</small></>},
        {id: 'go', header: t('tr.pl.acciones'), cell: o => <div className="pf-acts"><Button size="sm" onClick={() => { setFocus(o.id); setTeam(null); document.getElementById('detalle')?.scrollIntoView?.({block: 'start'}); }}>{t('tr.pl.detalle')}</Button><LinkButton href={`/platform/organizaciones/${o.id}`} size="sm">{t('tr.pl.ficha360', {n: 360})}</LinkButton></div>},
      ];
      const picked = v.organizations.filter(o => sel.has(o.id)), detail = v.organizations.find(o => o.id === focus);
      return <>
        <form className="pf-filters" role="search" aria-label={t('tr.pl.filtrarOrgs')} onSubmit={e => e.preventDefault()}>
          <label>{t('tr.pl.buscarNombre')}<input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('tr.pl.nombreOrg')} /></label>
          <label>{t('tr.pl.salud')}<select value={health} onChange={e => setHealth(e.target.value)}><option value="all">{t('tr.pl.todas')}</option>{Object.keys(HEALTH).map(k => <option key={k} value={k}>{healthLabel(k, t)}</option>)}</select></label>
        </form>
        <BulkBar count={sel.size} onClear={() => setSel(new Set())}>
          <Button size="sm" icon={<Download />} onClick={() => downloadCsv('organizaciones-seleccion.csv', [t('tr.pl.id'), t('tr.pl.organizacion'), t('tr.pl.salud'), t('tr.pl.miembros'), t('tr.pl.asientos')], picked.map(o => [o.id, o.name, healthLabel(o.health.level, t), o.members.total, o.ledger.rows]))}>{t('tr.pl.exportarSel')}</Button>
          <Button size="sm" onClick={() => void navigator.clipboard?.writeText(picked.map(o => o.id).join('\n'))}>{t('tr.pl.copiarIds')}</Button>
        </BulkBar>
        <Panel eyebrow={t('tr.pf.nDeM', {n: rows.length, m: v.organizations.length})} title={t('tr.pl.organizaciones')}>
          <DataTable caption={t('tr.pl.organizaciones')} rows={rows} columns={cols} rowKey={o => o.id} selectable selected={sel} onSelect={setSel} initialSort={{id: 'health', dir: 'asc'}} empty={<Empty title={t('tr.pf.sinResultados')}>{t('tr.pl.ningunaCoincide')}</Empty>} />
        </Panel>
        {detail && <Panel id="detalle" eyebrow={t('tr.pl.orgSel')} title={detail.name} actions={<><Button size="sm" icon={<PfIcon name="user" size={14} />} onClick={() => setTeam(detail.id)}>{t('tr.pl.gestionarEquipo')}</Button><LinkButton href="/platform/fuentes" size="sm">{t('tr.pl.verFuentes')}</LinkButton><Button size="sm" onClick={() => setFocus(null)}>{t('tr.pl.cerrar')}</Button></>}>
          <div className="pf-tiles"><Tile label={t('tr.pl.salud')} value={healthLabel(detail.health.level, t)} kind="observed" foot={detail.health.reasons.map((r: {text: string}) => textoServidor(r.text, t, idioma)).join(' · ') || t('tr.pl.sinMotivos')} />
            <Tile label={t('tr.pl.equipo')} value={t(detail.members.total === 1 ? 'tr.pl.miembro1' : 'tr.pl.nMiembros', {n: detail.members.total})} kind="observed" foot={t('tr.pl.rolesFoot', {owner: detail.members.owner, analyst: detail.members.analyst, operator: detail.members.operator, viewer: detail.members.viewer})} />
            <Tile label={t('tr.pl.gastoIa')} value={detail.aiSpent} kind="observed" foot={t('tr.pl.deLimite', {limit: detail.aiLimit})}><Meter bps={detail.aiPctBps} /></Tile>
            <Tile label={t('tr.pl.proyeccion')} value={'≈ ' + detail.aiProjected.display} kind="estimated" foot={detail.aiProjected.overLimit ? t('tr.pl.superariaTope') : t('tr.pl.dentroTope')} how={proyeccionHow(v.generatedAt, detail.aiProjected.how, t)} /></div>
          <p className="pf-statusbar"><IdChip value={detail.id} label={t('tr.pl.id')} /></p>
          {team === detail.id && <div className="pf-team"><TeamPanel key={detail.id} endpoint={`/api/platform/team?tenantId=${detail.id}`} platform /></div>}
        </Panel>}
        <CreateOrg onDone={ctl.reload} />
      </>;
    }}
  </Shell>;
}
function PartialOrgs({state}: {state: Extract<PlatformStateClient, {status: 'partial'}>}) {
  const {t, fmtDate} = useFmt();
  return <Panel title={t('tr.pl.orgsBasica')} eyebrow={t('tr.pl.obsNoConectada')} lead={partialReason(state, t)}><ul className="pf-list">{state.organizations.map(o => <li key={o.id}><div className="pf-li-main"><strong>{o.name}</strong><span>{t('tr.pl.creadaFecha', {fecha: fmtDate(o.createdAt)})}</span></div><LinkButton href={`/platform/organizaciones/${o.id}`} size="sm">{t('tr.pl.ficha360', {n: 360})}</LinkButton><IdChip value={o.id} /></li>)}</ul></Panel>;
}
function CreateOrg({onDone}: {onDone: () => Promise<void>}) {
  const t = useT();
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ok: boolean; text: string} | null>(null), [confirmed, setConfirmed] = useState(false), [rid, setRid] = useState(() => crypto.randomUUID());
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget, f = new FormData(form); setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/platform', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({operation: 'create', name: f.get('name'), ownerEmail: f.get('ownerEmail'), confirmed: f.get('confirmed') === 'on', requestId: rid}), signal: AbortSignal.timeout(15000)});
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.code === 'platform_owner_unavailable' ? t('tr.pl.crearResp') : j.error?.code === 'platform_self_change_forbidden' ? t('tr.pl.crearPropia') : t('tr.pl.crearFallo'));
      setRid(crypto.randomUUID()); form.reset(); setConfirmed(false); setMsg({ok: true, text: t('tr.pl.crearOk')}); await onDone();
    } catch (err) { setMsg({ok: false, text: err instanceof Error && !['TimeoutError', 'AbortError', 'TypeError'].includes(err.name) ? err.message : t('tr.pl.crearSinConfirmar')}); } finally { setBusy(false); }
  }
  return <Panel id="crear" eyebrow={t('tr.pl.nuevoEspacio')} title={t('tr.pl.crearOrg')} lead={t('tr.pl.crearLead')}>
    <form className="pf-form" onSubmit={submit}>
      <label>{t('tr.pl.nombreOrg')}<input name="name" required maxLength={200} disabled={busy} autoComplete="organization" onChange={() => setConfirmed(false)} /></label>
      <label>{t('tr.pl.correoResp')}<input name="ownerEmail" type="email" required maxLength={254} disabled={busy} autoComplete="email" onChange={() => setConfirmed(false)} /></label>
      <label className="pf-check-row"><input name="confirmed" type="checkbox" required checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />{t('tr.pl.confirmoOrg')}</label>
      <Button type="submit" variant="primary" loading={busy} icon={<PfIcon name="plus" />}>{t('tr.pl.crearOrg')}</Button>
    </form>
    {msg && <p className={'state' + (msg.ok ? '' : ' state-error')} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
  </Panel>;
}

// ---------------------------------------------------------------------------------------------- Fuentes
export function Sources({initial}: Props) {
  const ctl = usePlatform(initial), {t, int, pct, fmtDate} = useFmt(), [src, setSrc] = useState('all'), [onlyGaps, setOnlyGaps] = useState(false);
  return <Shell state={ctl.state} ctl={ctl} title={t('tr.pf.nFuentes')} description={t('tr.pl.fuentesDesc')}
    extra={ctl.state.status === 'ok' ? <Button icon={<Download />} onClick={() => { const v = (ctl.state as {view: PlatformView}).view; downloadCsv('plataforma-fuentes.csv', [t('tr.pl.fuente'), t('tr.pl.organizacion'), t('tr.pl.cargada'), t('tr.pl.total'), t('tr.pl.incorporadas'), t('tr.pl.rechazadas'), t('tr.pl.pendientes'), t('tr.pl.ultimaAct')], v.sources.flatMap((s: {key: string; label: string; cells: any[]}) => s.cells.map(c => [sourceName(s.key, s.label, t), c.organization, c.loaded ? t('tr.pl.si') : t('tr.pl.no'), c.total, c.incorporated, c.rejected, c.pending, c.lastUpdate]))); }}>{t('tr.pl.exportarCsv')}</Button> : null}>
    {v => {
      const list = v.sources.filter((s: {key: string}) => src === 'all' || s.key === src);
      return <>
        <form className="pf-filters" role="search" aria-label={t('tr.pl.filtrarFuentes')} onSubmit={e => e.preventDefault()}>
          <label>{t('tr.pl.fuente')}<select value={src} onChange={e => setSrc(e.target.value)}><option value="all">{t('tr.pl.todas')}</option>{EXPECTED_SOURCES.map(s => <option key={s.key} value={s.key}>{sourceName(s.key, s.label, t)}</option>)}</select></label>
          <Seg label={t('tr.pl.vista')} value={onlyGaps ? 'gaps' : 'all'} options={[{value: 'all', label: t('tr.pl.todo')}, {value: 'gaps', label: t('tr.pl.soloFaltantes')}]} onChange={x => setOnlyGaps(x === 'gaps')} />
        </form>
        {list.map((s: {key: string; label: string; cells: Array<{organizationId: string; organization: string; loaded: boolean; total: number; incorporated: number; rejected: number; pending: number; lastUpdate: string | null; coverageBps: number | null}>}) => {
          const cells = s.cells.filter(c => !onlyGaps || !c.loaded || c.rejected > 0 || c.pending > 0);
          return <Panel key={s.key} eyebrow={t('tr.pl.nDeMOrgs', {n: s.cells.filter(c => c.loaded).length, m: s.cells.length})} title={sourceName(s.key, s.label, t)} marca={s.key}>
            {cells.length === 0 ? <Empty title={t('tr.pl.sinFaltantes')}>{t('tr.pl.sinFaltantesTxt')}</Empty> : <ul className="pf-sources">{cells.map(c => <li key={c.organizationId} className="pf-src-row">
              <div className="pf-src-head"><strong>{c.organization}</strong>{c.loaded ? <span><strong>{pct(c.coverageBps)}</strong> {t('tr.pl.incorporadoDe', {inc: int(c.incorporated), total: int(c.total)})}</span> : <Pill tone="muted">{t('tr.pl.sinCargar')}</Pill>}</div>
              {c.loaded && <><div className="cov-track" role="img" aria-label={t('tr.pl.covAria', {fuente: sourceName(s.key, s.label, t), org: c.organization, inc: c.incorporated, rej: c.rejected, pen: c.pending, total: c.total})}>{c.incorporated > 0 && <span className="cov-seg cov-in" style={{flexBasis: c.incorporated * 100 / Math.max(1, c.total) + '%'}} />}{c.rejected > 0 && <span className="cov-seg cov-rej" style={{flexBasis: Math.max(1, c.rejected * 100 / c.total) + '%'}} />}{c.pending > 0 && <span className="cov-seg cov-pen" style={{flexBasis: Math.max(1, c.pending * 100 / c.total) + '%'}} />}</div>
                <p className="cov-meta">{t('tr.pl.covMeta', {rej: int(c.rejected), pen: int(c.pending), fecha: fmtDate(c.lastUpdate)})}</p></>}
            </li>)}</ul>}
          </Panel>;
        })}
        <ul className="legend" aria-label={t('tr.pl.leyenda')}><li><span className="sw cov-in" />{t('tr.pl.incorporado')}</li><li><span className="sw cov-rej" />{t('tr.pl.rechazado')}</li><li><span className="sw cov-pen" />{t('tr.pl.pendiente')}</li><li><span className="sw sw-empty" />{t('tr.pl.sinCargar')}</li></ul>
      </>;
    }}
  </Shell>;
}

// ---------------------------------------------------------------------------------------------- Procesos
type Job = PlatformView['jobs']['failed'][number];
export function Jobs({initial}: Props) {
  const ctl = usePlatform(initial), {t, int, fmtDate} = useFmt(), [sel, setSel] = useState<Set<string>>(new Set()), [confirm, setConfirm] = useState(false), [msg, setMsg] = useState<{ok: boolean; text: string} | null>(null);
  return <Shell state={ctl.state} ctl={ctl} title={t('tr.pl.jobsTitulo')} description={t('tr.pl.jobsDesc')}>
    {v => {
      const tot = v.jobs.totals, cols: Column<Job>[] = [
        {id: 'type', header: t('tr.pl.proceso'), sort: j => j.type, cell: j => <>{j.type}<small className="pf-sub">{t(j.attempts === 1 ? 'tr.pl.intento1' : 'tr.pl.intentoN', {n: j.attempts})}</small></>},
        {id: 'org', header: t('tr.pl.organizacion'), wrap: true, sort: j => j.organization, cell: j => j.organization},
        {id: 'state', header: t('tr.pl.estado'), sort: j => j.state, cell: j => <Pill tone={j.stuck ? 'bad' : 'warn'}>{j.stuck ? t('tr.pl.atascado') : j.state === 'failed' ? t('tr.pl.fallido') : j.state}</Pill>},
        {id: 'err', header: t('tr.pl.codigo'), cell: j => j.errorCode ?? '—'},
        {id: 'at', header: t('tr.pl.actualizado'), sort: j => j.updatedAt, cell: j => fmtDate(j.updatedAt)},
        {id: 'id', header: t('tr.pl.id'), cell: j => <IdChip value={j.id} />},
      ];
      const picked = v.jobs.failed.filter((j: Job) => sel.has(j.id));
      async function run(reason: string) {
        try {
          const r = await fetch('/platform/data/actions', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({action: 'job.retry', ids: picked.map((j: Job) => j.id), reason, requestId: crypto.randomUUID()})});
          const j = await r.json();
          setMsg(r.ok ? {ok: true, text: t(j.data.simulated ? (j.data.accepted === 1 ? 'tr.pl.reintentoSim1' : 'tr.pl.reintentoSimN') : (j.data.accepted === 1 ? 'tr.pl.reintentoOk1' : 'tr.pl.reintentoOkN'), {n: j.data.accepted})} : {ok: false, text: r.status === 501 ? t('tr.pl.accion501') : t('tr.pl.accionFallo')});
          setConfirm(false); setSel(new Set());
        } catch { setMsg({ok: false, text: t('tr.pl.sinConfirmarAudit')}); }
      }
      return <>
        <div className="pf-tiles pf-tiles-5"><Tile label={t('tr.pl.enCola')} value={int(tot.queued)} kind="observed" /><Tile label={t('tr.pl.enCurso')} value={int(tot.running)} kind="observed" /><Tile label={t('tr.pl.parciales')} value={int(tot.partial)} kind="observed" /><Tile label={t('tr.pl.fallidos30', {dias: VENTANA_DIAS})} value={int(tot.failed)} kind="observed" /><Tile label={t('tr.pl.atascados')} value={int(tot.stuck)} kind="observed" foot={t('tr.pl.atascadosFoot', {min: 15})} /></div>
        {msg && <p className={'state' + (msg.ok ? '' : ' state-error')} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
        <BulkBar count={sel.size} onClear={() => setSel(new Set())}><Button size="sm" variant="primary" icon={<PfIcon name="refresh" size={14} />} onClick={() => setConfirm(true)}>{t('tr.pl.reintentarSel')}</Button><Button size="sm" icon={<Download />} onClick={() => downloadCsv('procesos-seleccion.csv', [t('tr.pl.id'), t('tr.pl.proceso'), t('tr.pl.organizacion'), t('tr.pl.estado'), t('tr.pl.codigo')], picked.map((j: Job) => [j.id, j.type, j.organization, j.state, j.errorCode]))}>{t('tr.pl.exportarSel')}</Button></BulkBar>
        {confirm && <ConfirmRetry count={picked.length} onCancel={() => setConfirm(false)} onConfirm={run} />}
        <Panel eyebrow={t('tr.pl.requierenRevision')} title={t('tr.pl.fallidosAtascados', {n: v.jobs.failed.length})} lead={t('tr.pl.noContenidoProc')}>
          <DataTable caption={t('tr.pl.capProcFallidos')} rows={v.jobs.failed} columns={cols} rowKey={(j: Job) => j.id} selectable selected={sel} onSelect={setSel} empty={<Empty title={t('tr.pl.sinProcFallidos')}>{t('tr.pl.noProcFallidos')}</Empty>} />
        </Panel>
        <Panel eyebrow={t('tr.pl.importaciones')} title={t('tr.pl.importacionesOrg')}>
          <DataTable caption={t('tr.pl.importacionesOrg')} rows={v.organizations} rowKey={(o: Org) => o.id} columns={[
            {id: 'o', header: t('tr.pl.organizacion'), wrap: true, sort: (o: Org) => o.name, cell: (o: Org) => o.name}, {id: 't', header: t('tr.pl.total'), align: 'right', sort: (o: Org) => o.imports.total, cell: (o: Org) => int(o.imports.total)},
            {id: 'op', header: t('tr.pl.enCurso'), align: 'right', cell: (o: Org) => int(o.imports.open)}, {id: 'f', header: t('tr.pl.fallidas30', {dias: VENTANA_DIAS}), align: 'right', sort: (o: Org) => o.imports.failed, cell: (o: Org) => int(o.imports.failed)}, {id: 'l', header: t('tr.pl.ultima'), cell: (o: Org) => fmtDate(o.imports.lastAt)}]} />
        </Panel>
      </>;
    }}
  </Shell>;
}
function ConfirmRetry({count, onCancel, onConfirm}: {count: number; onCancel: () => void; onConfirm: (reason: string) => Promise<void>}) {
  const t = useT();
  const [reason, setReason] = useState(''), [ok, setOk] = useState(false), [busy, setBusy] = useState(false);
  return <Modal open alert onClose={onCancel} title={t(count === 1 ? 'tr.pl.reintentarN1' : 'tr.pl.reintentarN', {n: count})} describedBy="confirm-desc"
    footer={<><Button data-autofocus onClick={onCancel}>{t('tr.pf.cancelar')}</Button><Button variant="primary" loading={busy} disabled={!ok || reason.trim().length < MIN_MOTIVO} onClick={async () => { setBusy(true); await onConfirm(reason.trim()); setBusy(false); }}>{t('tr.pl.confirmarReintento')}</Button></>}>
    <p id="confirm-desc" className="ov-impact">{t('tr.pl.confirmDesc')}</p>
    <label className="field">{t('tr.pl.motivoMin', {n: MIN_MOTIVO})}<textarea rows={3} value={reason} maxLength={300} onChange={e => setReason(e.target.value)} /></label>
    <label className="pf-check-row"><input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} />{t('tr.pl.confirmoReintentar')}</label>
  </Modal>;
}

// ---------------------------------------------------------------------------------------------- Costos de IA
export function AiCosts({initial}: Props) {
  const ctl = usePlatform(initial), {t, int, pct} = useFmt();
  return <Shell state={ctl.state} ctl={ctl} title={t('tr.pf.nCostosIa')} description={t('tr.pl.costosDesc')}
    extra={ctl.state.status === 'ok' ? <Button icon={<Download />} onClick={() => { const v = (ctl.state as {view: PlatformView}).view; downloadCsv('plataforma-costos-ia.csv', [t('tr.pl.organizacion'), t('tr.pl.gasto'), t('tr.pl.tope'), t('tr.pl.usoTope'), t('tr.pl.proyEstimado'), t('tr.pl.reservasSinConciliar')], v.aiCosts.map((c: any) => [c.name, c.spent, c.limit, c.pctBps === null ? t('tr.pl.sinTope') : pct(c.pctBps), c.projected.display, c.uncertain])); }}>{t('tr.pl.exportarCsv')}</Button> : null}>
    {v => {
      const rows = v.aiCosts, cols: Column<(typeof rows)[number]>[] = [
        {id: 'n', header: t('tr.pl.organizacion'), wrap: true, sort: c => c.name, cell: c => c.name}, {id: 's', header: t('tr.pl.gastoMes'), align: 'right', sort: c => Number(c.pctBps ?? 0), cell: c => c.spent},
        {id: 'l', header: t('tr.pl.tope'), align: 'right', cell: c => c.limit}, {id: 'p', header: t('tr.pl.usoTope'), sort: c => c.pctBps, cell: c => <><Meter bps={c.pctBps} /><small className="pf-sub">{pct(c.pctBps)}</small></>},
        {id: 'pr', header: t('tr.pl.proyeccion'), align: 'right', cell: c => <>≈ {c.projected.display} <KindBadge kind="estimated" />{c.projected.overLimit && <small className="pf-sub">{t('tr.pl.superariaTope')}</small>}</>},
        {id: 'u', header: t('tr.pl.sinConciliar'), align: 'right', sort: c => c.uncertain, cell: c => int(c.uncertain)}];
      return <>
        <div className="pf-tiles"><Tile label={t('tr.pl.gastoTotalMes')} value={v.kpis.aiSpent} kind="observed" foot={t('tr.pl.deEnTopes', {limit: v.kpis.aiLimit})}><Meter bps={v.kpis.aiPctBps} /></Tile>
          <Tile label={t('tr.pl.orgsSobre', {n: UMBRAL_IA})} value={int(rows.filter(c => (c.pctBps ?? 0) >= UMBRAL_IA * 100).length)} kind="observed" foot={t('tr.pl.cercanasTope')} />
          <Tile label={t('tr.pl.reservasSinConciliar')} value={int(rows.reduce((a, c) => a + c.uncertain, 0))} kind="observed" foot={t('tr.pl.inciertas')} /></div>
        <Panel eyebrow={t('tr.pl.unidades')} title={t('tr.pl.gastoContraTopeOrg')} lead={t('tr.pl.gastoLead')}>
          <DataTable caption={t('tr.pl.capGastoIa')} rows={rows} columns={cols} rowKey={c => c.id} initialSort={{id: 'p', dir: 'desc'}} />
          <HowTo text={rows[0] ? proyeccionHow(v.generatedAt, rows[0].projected.how, t) : ''} label={t('tr.pl.comoProy')} />
        </Panel>
      </>;
    }}
  </Shell>;
}

// ---------------------------------------------------------------------------------------------- Alertas
export function Alerts({initial}: Props) {
  const ctl = usePlatform(initial), {t, idioma, fmtDate} = useFmt(), [sev, setSev] = useState('all');
  return <Shell state={ctl.state} ctl={ctl} title={t('tr.pl.alertasTitulo')} description={t('tr.pl.alertasDesc')}>
    {v => {
      const list = v.alerts.filter((a: any) => sev === 'all' || a.severity === sev);
      return <>
        <form className="pf-filters" onSubmit={e => e.preventDefault()}><Seg label={t('tr.pl.severidad')} value={sev} options={[{value: 'all', label: t('tr.pl.todas')}, {value: 'alta', label: t('tr.pl.altas')}, {value: 'media', label: t('tr.pl.medias')}, {value: 'info', label: t('tr.pl.informativas')}]} onChange={setSev} /></form>
        <Panel eyebrow={t(list.length === 1 ? 'tr.pl.alerta1' : 'tr.pl.alertaN', {n: list.length})} title={t('tr.pf.nAlertas')}>
          {list.length === 0 ? <Empty title={t('tr.pl.sinAlertas')}>{t('tr.pl.noAlertasFiltro')}</Empty> : <ul className="pf-list">{list.map((a: any) => <li key={a.id}><div className="pf-li-main"><div className="pf-li-head"><Pill tone={severityTone(a.severity)}>{severityLabel(a.severity, t)}</Pill><KindBadge kind={a.unknown ? 'unclassified' : 'observed'} /></div><strong>{textoServidor(a.title, t, idioma)}</strong><span>{a.organization ?? textoServidor(a.detail, t, idioma)}</span>{a.unknown && <span>{t('tr.pl.paraConectarla', {source: a.source ? textoServidor(a.source, t, idioma) : t('tr.pl.laFuente')})}</span>}</div>{a.organizationId && <LinkButton href={`/platform/organizaciones?org=${a.organizationId}`} size="sm">{t('tr.pl.verOrg')}</LinkButton>}</li>)}</ul>}
        </Panel>
        <Panel eyebrow={t('tr.pl.senalesPlat')} title={t('tr.pl.estadoInfra')}><ul className="pf-list">{v.opsSignals.map((s: any) => <li key={s.kind}><div className="pf-li-main"><div className="pf-li-head"><strong>{textoServidor(s.title, t, idioma)}</strong><Pill tone={s.status === 'ok' ? 'ok' : s.status === 'warn' ? 'warn' : s.status === 'crit' ? 'bad' : 'muted'}>{s.status === 'ok' ? t('tr.pl.normal') : s.status === 'warn' ? t('tr.pl.atencion') : s.status === 'crit' ? t('tr.pl.critico') : t('tr.pl.sinFuente')}</Pill></div><span>{textoServidor(s.detail, t, idioma)}</span><span>{s.observedAt ? t('tr.pl.observado', {fecha: fmtDate(s.observedAt), source: textoServidor(s.source, t, idioma)}) : t('tr.pl.sinObservacion')}</span></div></li>)}</ul></Panel>
      </>;
    }}
  </Shell>;
}

// ---------------------------------------------------------------------------------------------- Auditoría
export function AuditLog({initial}: Props) {
  const ctl = usePlatform(initial), {t, fmtDate} = useFmt(), [op, setOp] = useState('all');
  const audit = ctl.state.status === 'ok' ? ctl.state.view.audit : ctl.state.status === 'partial' ? ctl.state.audit : [];
  const orgs = useMemo(() => (ctl.state.status === 'ok' ? ctl.state.view.organizations : ctl.state.status === 'partial' ? ctl.state.organizations : []) as Array<{id: string; name: string}>, [ctl.state]);
  const rows = audit.filter((a: any) => op === 'all' || a.operation === op);
  const cols: Column<(typeof audit)[number]>[] = [
    {id: 'at', header: t('tr.pl.fecha'), sort: (a: any) => a.createdAt, cell: (a: any) => fmtDate(a.createdAt)}, {id: 'op', header: t('tr.pl.operacion'), sort: (a: any) => a.operation, cell: (a: any) => opLabel(a.operation, t)},
    {id: 'org', header: t('tr.pl.organizacion'), wrap: true, cell: (a: any) => orgs.find(o => o.id === a.tenantId)?.name ?? t('tr.pf.plataforma')}, {id: 'actor', header: t('tr.pl.actor'), cell: (a: any) => <IdChip value={a.actorId} label={t('tr.pl.admin')} />}, {id: 'id', header: t('tr.pl.registro'), cell: (a: any) => <IdChip value={String(a.id)} />}];
  if (ctl.state.status === 'denied' || ctl.state.status === 'error') return <Shell state={ctl.state} ctl={ctl} title={t('tr.pf.nAuditoria')} description={t('tr.pl.auditDescCorta')}>{() => null}</Shell>;
  return <Shell state={{status: 'ok', synthetic: ctl.state.status === 'ok' && ctl.state.synthetic, view: {generatedAt: new Date().toISOString()} as PlatformView}} ctl={ctl} title={t('tr.pf.nAuditoria')} description={t('tr.pl.auditDesc')}
    extra={<Button icon={<Download />} onClick={() => downloadCsv('plataforma-auditoria.csv', [t('tr.pl.id'), t('tr.pl.fecha'), t('tr.pl.operacion'), t('tr.pl.organizacion'), t('tr.pl.actor')], rows.map((a: any) => [a.id, a.createdAt, a.operation, orgs.find(o => o.id === a.tenantId)?.name ?? t('tr.pf.plataforma'), a.actorId]))}>{t('tr.pl.exportarCsv')}</Button>}>
    {() => <>
      {ctl.state.status === 'partial' && <p className="pf-banner" role="note"><PfIcon name="info" />{t('tr.pl.obsParcialAudit')}</p>}
      <form className="pf-filters" onSubmit={e => e.preventDefault()}><label>{t('tr.pl.operacion')}<select value={op} onChange={e => setOp(e.target.value)}><option value="all">{t('tr.pl.todas')}</option>{[...new Set(audit.map((a: any) => a.operation))].map(o => <option key={o as string} value={o as string}>{opLabel(o as string, t)}</option>)}</select></label></form>
      <Panel eyebrow={t(rows.length === 1 ? 'tr.pl.registro1' : 'tr.pl.registroN', {n: rows.length})} title={t('tr.pl.bitacoraAdmin')}><DataTable caption={t('tr.pl.bitacoraAdmin')} rows={rows} columns={cols} rowKey={(a: any) => String(a.id)} initialSort={{id: 'at', dir: 'desc'}} empty={<Empty title={t('tr.pl.sinRegistros')}>{t('tr.pl.noOperacionesFiltro')}</Empty>} /></Panel>
    </>}
  </Shell>;
}
export {Skeleton};
