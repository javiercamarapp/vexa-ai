'use client';
import {useAutoRefresh} from '../ui/use-auto-refresh';
/* eslint-disable @typescript-eslint/no-explicit-any -- la vista de plataforma es JSON agregado de contrato abierto (platform_observe); los campos se validan en el modelo puro */
import {useSearchParams} from 'next/navigation';
import {useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode} from 'react';
import {PageHeader} from '../ui/page-header';
import {Button, LinkButton, Refresh, Download} from '../ui/button';
import {KindBadge} from '../ui/kind-badge';
import {Modal} from '../ui/overlay';
import {IdChip} from '../ui/id-chip';
import {BarChart, type BarDatum} from '../ui/bar-chart';
import {TeamPanel} from '../team-panel';
import {CopilotPanel} from './copilot-panel';
import {BulkBar, DataTable, downloadCsv, type Column} from './data-table';
import {PfIcon} from './icons';
import {Empty, HowTo, Meter, Panel, Pill, Seg, Tile, healthTone, severityTone, Skeleton} from './primitives';
import {EXPECTED_SOURCES, HEALTH, PLATFORM_SHORTCUTS, SEVERITY_LABEL} from '../../../../../packages/cfo-copilot/src/client.mjs';
import type {PlatformView} from '../../../../../packages/cfo-copilot/src/index.mjs';
import {int, pct} from '../../../../../packages/cfo-copilot/src/format.mjs';
import './platform-ui.css';

type Org = PlatformView['organizations'][number];
export type PlatformStateClient =
  | {status: 'ok'; view: PlatformView; synthetic: boolean}
  | {status: 'partial'; reason: string; organizations: Array<{id: string; name: string; createdAt: string}>; audit: Array<{id: string; actorId: string; operation: string; tenantId: string | null; createdAt: string}>}
  | {status: 'denied' | 'error'};
type Props = {initial: PlatformStateClient};
const fmtDate = (iso: string | null) => (iso ? new Intl.DateTimeFormat('es-MX', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC'}).format(new Date(iso)) + ' UTC' : 'Sin registro');
const OPERATIONS: Record<string, string> = {create: 'Organización creada', team_invite: 'Invitación enviada', team_role: 'Cambio de rol', team_revoke: 'Acceso revocado', team_cancel: 'Invitación cancelada', team_claim: 'Entrega de invitación', team_receipt: 'Recibo de entrega', copilot_query: 'Consulta del copiloto'};

function usePlatform(initial: PlatformStateClient) {
  const [state, setState] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const reload = useCallback(async () => {
    setBusy(true); setError('');
    try { const r = await fetch('/platform/data/view', {cache: 'no-store', signal: AbortSignal.timeout(20000)}); const j = await r.json(); if (!r.ok) throw new Error(); setState(j.data); }
    catch { setError('No se pudo actualizar. Conservo las cifras anteriores; se reintentará solo.'); } finally { setBusy(false); }
  }, []);
  // Datos nuevos: relectura en segundo plano (conserva las cifras pintadas); no corre si ya hay una lectura en curso.
  const busyRef = useRef(false); busyRef.current = busy;
  useAutoRefresh(reload, {ocupado: () => busyRef.current});
  return {state, busy, error, reload};
}
function Shell({title, description, eyebrow = 'Consola de plataforma', ctl, extra, children, state}: {title: string; description: string; eyebrow?: string; ctl: ReturnType<typeof usePlatform>; extra?: ReactNode; children: (view: PlatformView) => ReactNode; state: PlatformStateClient}) {
  const actions = <>
    <CopilotPanel endpoint="/platform/data/copilot" title="Copiloto de plataforma" subtitle="Organizaciones, fuentes, procesos y costos, con la cifra que ya calculó la consola." placeholder="Pregunta sobre organizaciones, procesos o costos de IA…" shortcuts={PLATFORM_SHORTCUTS} openLabel="Copiloto" context="Pregunta a la plataforma" />
    {extra}</>;
  return <div className="pf-page">
    <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />
    <div className="pf-banner" role="note"><PfIcon name="shield" /><p><strong>Acceso administrativo.</strong> Esta consola muestra conteos, estados y gasto por organización. No concede acceso al contenido de los clientes y el copiloto no lo lee.</p></div>
    {ctl.error && <p className="state state-error" role="alert">{ctl.error}</p>}
    {state.status === 'ok' && state.synthetic && <p className="pf-statusbar"><Pill tone="warn">Datos sintéticos de demostración</Pill><span>Generado {fmtDate(state.view.generatedAt)}</span></p>}
    {state.status === 'ok' ? children(state.view)
      : state.status === 'partial' ? <Empty title="Observabilidad no conectada" tone="muted">{state.reason} Consulta el apartado «Organizaciones» y «Auditoría», que usan funciones ya aplicadas.</Empty>
      : state.status === 'denied' ? <Empty tone="bad" title="Sin acceso">No tienes acceso a la administración de plataforma.</Empty>
      : <Empty tone="bad" title="No disponible" action={<Button icon={<Refresh />} onClick={() => void ctl.reload()}>Reintentar</Button>}>No se pudo leer la plataforma. Verifica tu acceso e inténtalo de nuevo.</Empty>}
  </div>;
}
const HealthPill = ({o}: {o: Org}) => <Pill tone={healthTone(o.health.level)} title={o.health.reasons.map((r: {text: string}) => r.text).join('; ')}>{o.health.label}</Pill>;

// ---------------------------------------------------------------------------------------------- Resumen
export function Overview({initial}: Props) {
  const ctl = usePlatform(initial);
  return <Shell state={ctl.state} ctl={ctl} title="Resumen de plataforma" description="Salud de las organizaciones, procesos, fuentes y gasto de IA en un vistazo. Cada tarjeta lleva a su detalle."
    extra={ctl.state.status === 'ok' ? <Button icon={<Download />} onClick={() => { const v = (ctl.state as {view: PlatformView}).view; downloadCsv('plataforma-organizaciones.csv', ['Organización', 'Salud', 'Miembros', 'Asientos', 'Fuentes cargadas', 'Procesos fallidos', 'Gasto de IA', 'Tope de IA'], v.organizations.map(o => [o.name, o.health.label, o.members.total, o.ledger.rows, `${o.sourcesLoaded}/${o.sourcesExpected}`, o.jobs.failed, o.aiSpent, o.aiLimit])); }}>Exportar CSV</Button> : null}>
    {v => {
      const k = v.kpis, attention = v.organizations.filter(o => o.health.level !== 'healthy'), ai: BarDatum[] = v.aiCosts.filter(c => c.pctBps !== null).slice(0, 5).map(c => ({key: c.id, label: c.name, value: c.pctBps ?? 0, display: `${c.spent} · ${pct(c.pctBps)}`, kind: 'observed' as const}));
      const loaded = v.organizations.reduce((a, o) => a + o.sourcesLoaded, 0), expected = v.organizations.length * EXPECTED_SOURCES.length;
      return <>
        <div className="pf-tiles reveal">
          <Tile label="Organizaciones" value={int(k.organizations)} kind="observed" foot={`${k.healthy} saludables · ${k.attention} con atención · ${k.critical} críticas`} />
          <Tile label="Alertas abiertas" value={int(k.openAlerts)} kind="observed" foot="Incluye señales sin fuente conectada como informativas" />
          <Tile label="Procesos fallidos" value={int(k.failedJobs)} kind="observed" foot={`${k.stuckJobs} atascados · ${k.queued} en cola · ${k.running} en curso`} />
          <Tile label="Asientos del ledger" value={int(k.ledgerRows)} kind="observed" foot="Todas las organizaciones" />
          <Tile label="Gasto de IA del mes" value={k.aiSpent} kind="observed" foot={`de ${k.aiLimit} · ${pct(k.aiPctBps)} del tope sumado`}><Meter bps={k.aiPctBps} /></Tile>
          <Tile label="Fuentes cargadas" value={`${loaded} de ${expected}`} kind="observed" foot="Pares organización–fuente con datos" coverage={pct(Math.round(loaded * 10000 / Math.max(1, expected))) + ' de cobertura'} />
        </div>
        <div className="pf-grid-2">
          <Panel eyebrow="Requieren atención" title={`Organizaciones (${attention.length})`} actions={<LinkButton href="/platform/organizaciones" size="sm">Ver todas</LinkButton>}>
            {attention.length === 0 ? <Empty title="Todo en orden">Ninguna organización tiene motivos de atención.</Empty> : <ul className="pf-list">{attention.map(o => <li key={o.id}><div className="pf-li-main"><div className="pf-li-head"><strong>{o.name}</strong><HealthPill o={o} /></div><span>{o.health.reasons.filter((r: {level: string}) => r.level !== 'info').map((r: {text: string}) => r.text).join(' · ')}</span></div><LinkButton href={`/platform/organizaciones?org=${o.id}`} size="sm" icon={<PfIcon name="chevron" size={14} />}>Ver detalle</LinkButton></li>)}</ul>}
          </Panel>
          <Panel eyebrow="Operación" title="Alertas recientes" actions={<LinkButton href="/platform/alertas" size="sm">Ver todas</LinkButton>}>
            <ul className="pf-list">{v.alerts.slice(0, 5).map(a => <li key={a.id}><div className="pf-li-main"><div className="pf-li-head"><Pill tone={severityTone(a.severity)}>{SEVERITY_LABEL[a.severity]}</Pill></div><strong>{a.title}</strong><span>{a.organization ?? a.detail}</span></div></li>)}</ul>
          </Panel>
        </div>
        <div className="pf-grid-2">
          <Panel eyebrow="Costos" title="Gasto de IA contra el tope" actions={<LinkButton href="/platform/costos-ia" size="sm">Ver detalle</LinkButton>}>{ai.length ? <BarChart title="Top por uso del tope" unit="% del tope" data={ai} /> : <Empty title="Sin topes definidos" />}</Panel>
          <Panel eyebrow="Trazabilidad" title="Actividad administrativa reciente" actions={<LinkButton href="/platform/auditoria" size="sm">Ver bitácora</LinkButton>}>
            <ul className="pf-list">{v.audit.slice(0, 4).map(a => <li key={a.id}><div className="pf-li-main"><strong>{OPERATIONS[a.operation] ?? a.operation}</strong><span>{fmtDate(a.createdAt)} · {v.organizations.find(o => o.id === a.tenantId)?.name ?? 'Plataforma'}</span></div></li>)}</ul>
          </Panel>
        </div>
      </>;
    }}
  </Shell>;
}

// ---------------------------------------------------------------------------------------------- Organizaciones
export function Organizations({initial}: Props) {
  const ctl = usePlatform(initial), [q, setQ] = useState(''), [health, setHealth] = useState('all'), [sel, setSel] = useState<Set<string>>(new Set()), [team, setTeam] = useState<string | null>(null);
  const params = useSearchParams(), [focus, setFocus] = useState<string | null>(params.get('org'));
  if (ctl.state.status === 'partial') return <Shell state={{status: 'ok', synthetic: false, view: {organizations: [], alerts: [], audit: [], aiCosts: [], sources: [], opsSignals: [], jobs: {totals: {}, failed: []}, counts: {healthy: 0, attention: 0, critical: 0}, kpis: {}, generatedAt: new Date().toISOString()}}} ctl={ctl} title="Organizaciones" description="Gestiona los espacios de trabajo y a sus responsables.">{() => <PartialOrgs state={ctl.state as Extract<PlatformStateClient, {status: 'partial'}>} />}</Shell>;
  return <Shell state={ctl.state} ctl={ctl} title="Organizaciones" description="Salud, uso y equipo de cada espacio de trabajo. Filtra, ordena y actúa sobre varias a la vez.">
    {v => {
      const rows = v.organizations.filter(o => (health === 'all' || o.health.level === health) && (!q || o.name.toLowerCase().includes(q.toLowerCase())));
      const cols: Column<Org>[] = [
        {id: 'name', header: 'Organización', wrap: true, sort: o => o.name, cell: o => <><strong>{o.name}</strong><small className="pf-sub">Creada {fmtDate(o.createdAt).split(',')[0]} · actividad {o.lastActivityAt ? fmtDate(o.lastActivityAt).split(',')[0] : 'sin registro'}</small></>},
        {id: 'health', header: 'Salud', sort: o => ({critical: 0, attention: 1, healthy: 2} as Record<string, number>)[o.health.level], cell: o => <HealthPill o={o} />},
        {id: 'members', header: 'Miembros', align: 'right', sort: o => o.members.total, cell: o => <>{int(o.members.total)}{o.invitationsPending > 0 && <small className="pf-sub">{o.invitationsPending} invitación(es)</small>}</>},
        {id: 'ledger', header: 'Asientos', align: 'right', sort: o => o.ledger.rows, cell: o => int(o.ledger.rows)},
        {id: 'src', header: 'Fuentes', align: 'right', sort: o => o.sourcesLoaded, cell: o => `${o.sourcesLoaded} de ${o.sourcesExpected}`},
        {id: 'jobs', header: 'Procesos fallidos', align: 'right', sort: o => o.jobs.failed, cell: o => int(o.jobs.failed)},
        {id: 'ai', header: 'IA', sort: o => o.aiPctBps, cell: o => <><Meter bps={o.aiPctBps} /><small className="pf-sub">{o.aiSpent} de {o.aiLimit}</small></>},
        {id: 'go', header: 'Acciones', cell: o => <Button size="sm" onClick={() => { setFocus(o.id); setTeam(null); document.getElementById('detalle')?.scrollIntoView?.({block: 'start'}); }}>Ver detalle</Button>},
      ];
      const picked = v.organizations.filter(o => sel.has(o.id)), detail = v.organizations.find(o => o.id === focus);
      return <>
        <form className="pf-filters" role="search" aria-label="Filtrar organizaciones" onSubmit={e => e.preventDefault()}>
          <label>Buscar por nombre<input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Nombre de la organización" /></label>
          <label>Salud<select value={health} onChange={e => setHealth(e.target.value)}><option value="all">Todas</option>{Object.entries(HEALTH).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        </form>
        <BulkBar count={sel.size} onClear={() => setSel(new Set())}>
          <Button size="sm" icon={<Download />} onClick={() => downloadCsv('organizaciones-seleccion.csv', ['Id', 'Organización', 'Salud', 'Miembros', 'Asientos'], picked.map(o => [o.id, o.name, o.health.label, o.members.total, o.ledger.rows]))}>Exportar selección</Button>
          <Button size="sm" onClick={() => void navigator.clipboard?.writeText(picked.map(o => o.id).join('\n'))}>Copiar identificadores</Button>
        </BulkBar>
        <Panel eyebrow={`${rows.length} de ${v.organizations.length}`} title="Organizaciones">
          <DataTable caption="Organizaciones" rows={rows} columns={cols} rowKey={o => o.id} selectable selected={sel} onSelect={setSel} initialSort={{id: 'health', dir: 'asc'}} empty={<Empty title="Sin resultados">Ninguna organización coincide con los filtros.</Empty>} />
        </Panel>
        {detail && <Panel id="detalle" eyebrow="Organización seleccionada" title={detail.name} actions={<><Button size="sm" icon={<PfIcon name="user" size={14} />} onClick={() => setTeam(detail.id)}>Gestionar equipo</Button><LinkButton href="/platform/fuentes" size="sm">Ver fuentes</LinkButton><Button size="sm" onClick={() => setFocus(null)}>Cerrar</Button></>}>
          <div className="pf-tiles"><Tile label="Salud" value={detail.health.label} kind="observed" foot={detail.health.reasons.map((r: {text: string}) => r.text).join(' · ') || 'Sin motivos de atención'} />
            <Tile label="Equipo" value={`${detail.members.total} miembros`} kind="observed" foot={`${detail.members.owner} propietario · ${detail.members.analyst} analista · ${detail.members.operator} operador · ${detail.members.viewer} lector`} />
            <Tile label="Gasto de IA" value={detail.aiSpent} kind="observed" foot={`de ${detail.aiLimit}`}><Meter bps={detail.aiPctBps} /></Tile>
            <Tile label="Proyección al cierre" value={'≈ ' + detail.aiProjected.display} kind="estimated" foot={detail.aiProjected.overLimit ? 'Superaría el tope' : 'Dentro del tope'} how={detail.aiProjected.how} /></div>
          <p className="pf-statusbar"><IdChip value={detail.id} label="Id" /></p>
          {team === detail.id && <div className="pf-team"><TeamPanel key={detail.id} endpoint={`/api/platform/team?tenantId=${detail.id}`} platform /></div>}
        </Panel>}
        <CreateOrg onDone={ctl.reload} />
      </>;
    }}
  </Shell>;
}
function PartialOrgs({state}: {state: Extract<PlatformStateClient, {status: 'partial'}>}) {
  return <Panel title="Organizaciones (lista básica)" eyebrow="Observabilidad no conectada" lead={state.reason}><ul className="pf-list">{state.organizations.map(o => <li key={o.id}><div className="pf-li-main"><strong>{o.name}</strong><span>Creada {fmtDate(o.createdAt)}</span></div><IdChip value={o.id} /></li>)}</ul></Panel>;
}
function CreateOrg({onDone}: {onDone: () => Promise<void>}) {
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ok: boolean; text: string} | null>(null), [confirmed, setConfirmed] = useState(false), [rid, setRid] = useState(() => crypto.randomUUID());
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget, f = new FormData(form); setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/platform', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({operation: 'create', name: f.get('name'), ownerEmail: f.get('ownerEmail'), confirmed: f.get('confirmed') === 'on', requestId: rid}), signal: AbortSignal.timeout(15000)});
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.code === 'platform_owner_unavailable' ? 'El responsable necesita una cuenta existente con correo confirmado.' : j.error?.code === 'platform_self_change_forbidden' ? 'Usa una cuenta responsable diferente de tu cuenta de plataforma.' : 'No se pudo crear la organización. Verifica tu acceso.');
      setRid(crypto.randomUUID()); form.reset(); setConfirmed(false); setMsg({ok: true, text: 'Organización creada con un propietario activo. No se envió ningún correo. Queda en la auditoría.'}); await onDone();
    } catch (err) { setMsg({ok: false, text: err instanceof Error && !['TimeoutError', 'AbortError', 'TypeError'].includes(err.name) ? err.message : 'No se confirmó el resultado. Conserva los datos y reintenta; el intento no crea duplicados.'}); } finally { setBusy(false); }
  }
  return <Panel id="crear" eyebrow="Nuevo espacio" title="Crear organización" lead="El responsable debe tener una cuenta existente con correo confirmado y recibirá el rol de propietario. La creación no envía correos y queda registrada en la auditoría.">
    <form className="pf-form" onSubmit={submit}>
      <label>Nombre de la organización<input name="name" required maxLength={200} disabled={busy} autoComplete="organization" onChange={() => setConfirmed(false)} /></label>
      <label>Correo del responsable<input name="ownerEmail" type="email" required maxLength={254} disabled={busy} autoComplete="email" onChange={() => setConfirmed(false)} /></label>
      <label className="pf-check-row"><input name="confirmed" type="checkbox" required checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />Confirmo la organización y el responsable.</label>
      <Button type="submit" variant="primary" loading={busy} icon={<PfIcon name="plus" />}>Crear organización</Button>
    </form>
    {msg && <p className={'state' + (msg.ok ? '' : ' state-error')} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
  </Panel>;
}

// ---------------------------------------------------------------------------------------------- Fuentes
export function Sources({initial}: Props) {
  const ctl = usePlatform(initial), [src, setSrc] = useState('all'), [onlyGaps, setOnlyGaps] = useState(false);
  return <Shell state={ctl.state} ctl={ctl} title="Fuentes y cargas" description="Cobertura por fuente y organización: importaciones, Tracker, adjuntos, ledger y asociaciones. Una fuente sin cargar no es «cero cargado»."
    extra={ctl.state.status === 'ok' ? <Button icon={<Download />} onClick={() => { const v = (ctl.state as {view: PlatformView}).view; downloadCsv('plataforma-fuentes.csv', ['Fuente', 'Organización', 'Cargada', 'Total', 'Incorporadas', 'Rechazadas', 'Pendientes', 'Última actualización'], v.sources.flatMap((s: {label: string; cells: any[]}) => s.cells.map(c => [s.label, c.organization, c.loaded ? 'Sí' : 'No', c.total, c.incorporated, c.rejected, c.pending, c.lastUpdate]))); }}>Exportar CSV</Button> : null}>
    {v => {
      const list = v.sources.filter((s: {key: string}) => src === 'all' || s.key === src);
      return <>
        <form className="pf-filters" role="search" aria-label="Filtrar fuentes" onSubmit={e => e.preventDefault()}>
          <label>Fuente<select value={src} onChange={e => setSrc(e.target.value)}><option value="all">Todas</option>{EXPECTED_SOURCES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
          <Seg label="Vista" value={onlyGaps ? 'gaps' : 'all'} options={[{value: 'all', label: 'Todo'}, {value: 'gaps', label: 'Solo faltantes'}]} onChange={x => setOnlyGaps(x === 'gaps')} />
        </form>
        {list.map((s: {key: string; label: string; cells: Array<{organizationId: string; organization: string; loaded: boolean; total: number; incorporated: number; rejected: number; pending: number; lastUpdate: string | null; coverageBps: number | null}>}) => {
          const cells = s.cells.filter(c => !onlyGaps || !c.loaded || c.rejected > 0 || c.pending > 0);
          return <Panel key={s.key} eyebrow={`${s.cells.filter(c => c.loaded).length} de ${s.cells.length} organizaciones`} title={s.label}>
            {cells.length === 0 ? <Empty title="Sin faltantes">Todas las organizaciones tienen esta fuente cargada y sin pendientes.</Empty> : <ul className="pf-sources">{cells.map(c => <li key={c.organizationId} className="pf-src-row">
              <div className="pf-src-head"><strong>{c.organization}</strong>{c.loaded ? <span><strong>{pct(c.coverageBps)}</strong> incorporado · {int(c.incorporated)} de {int(c.total)}</span> : <Pill tone="muted">Sin cargar</Pill>}</div>
              {c.loaded && <><div className="cov-track" role="img" aria-label={`${s.label}, ${c.organization}: ${c.incorporated} incorporadas, ${c.rejected} rechazadas, ${c.pending} pendientes de ${c.total}`}>{c.incorporated > 0 && <span className="cov-seg cov-in" style={{flexBasis: c.incorporated * 100 / Math.max(1, c.total) + '%'}} />}{c.rejected > 0 && <span className="cov-seg cov-rej" style={{flexBasis: Math.max(1, c.rejected * 100 / c.total) + '%'}} />}{c.pending > 0 && <span className="cov-seg cov-pen" style={{flexBasis: Math.max(1, c.pending * 100 / c.total) + '%'}} />}</div>
                <p className="cov-meta">{int(c.rejected)} rechazadas · {int(c.pending)} pendientes · actualizada {fmtDate(c.lastUpdate)}</p></>}
            </li>)}</ul>}
          </Panel>;
        })}
        <ul className="legend" aria-label="Leyenda"><li><span className="sw cov-in" />Incorporado</li><li><span className="sw cov-rej" />Rechazado</li><li><span className="sw cov-pen" />Pendiente</li><li><span className="sw sw-empty" />Sin cargar</li></ul>
      </>;
    }}
  </Shell>;
}

// ---------------------------------------------------------------------------------------------- Procesos
type Job = PlatformView['jobs']['failed'][number];
export function Jobs({initial}: Props) {
  const ctl = usePlatform(initial), [sel, setSel] = useState<Set<string>>(new Set()), [confirm, setConfirm] = useState(false), [msg, setMsg] = useState<{ok: boolean; text: string} | null>(null);
  return <Shell state={ctl.state} ctl={ctl} title="Procesos y colas" description="Procesos en segundo plano, importaciones y colas. Solo lectura, con acciones seguras que piden confirmación y quedan en la auditoría.">
    {v => {
      const t = v.jobs.totals, cols: Column<Job>[] = [
        {id: 'type', header: 'Proceso', sort: j => j.type, cell: j => <>{j.type}<small className="pf-sub">{j.attempts} intento(s)</small></>},
        {id: 'org', header: 'Organización', wrap: true, sort: j => j.organization, cell: j => j.organization},
        {id: 'state', header: 'Estado', sort: j => j.state, cell: j => <Pill tone={j.stuck ? 'bad' : 'warn'}>{j.stuck ? 'Atascado' : j.state === 'failed' ? 'Fallido' : j.state}</Pill>},
        {id: 'err', header: 'Código', cell: j => j.errorCode ?? '—'},
        {id: 'at', header: 'Actualizado', sort: j => j.updatedAt, cell: j => fmtDate(j.updatedAt)},
        {id: 'id', header: 'Id', cell: j => <IdChip value={j.id} />},
      ];
      const picked = v.jobs.failed.filter((j: Job) => sel.has(j.id));
      async function run(reason: string) {
        try {
          const r = await fetch('/platform/data/actions', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({action: 'job.retry', ids: picked.map((j: Job) => j.id), reason, requestId: crypto.randomUUID()})});
          const j = await r.json();
          setMsg(r.ok ? {ok: true, text: `${j.data.accepted} proceso(s) enviados a reintento${j.data.simulated ? ' (SIMULADO: la demostración no modifica nada)' : ''}. Quedó registrado en la auditoría.`} : {ok: false, text: r.status === 501 ? 'Esta acción aún no está conectada a la base: requiere la función platform_job_retry (ver NOTAS). No se cambió nada.' : 'No se pudo completar la acción. No se cambió nada.'});
          setConfirm(false); setSel(new Set());
        } catch { setMsg({ok: false, text: 'No se confirmó el resultado. Revisa la auditoría antes de reintentar.'}); }
      }
      return <>
        <div className="pf-tiles"><Tile label="En cola" value={int(t.queued)} kind="observed" /><Tile label="En curso" value={int(t.running)} kind="observed" /><Tile label="Parciales" value={int(t.partial)} kind="observed" /><Tile label="Fallidos (30 d)" value={int(t.failed)} kind="observed" /><Tile label="Atascados" value={int(t.stuck)} kind="observed" foot="En curso con lease vencido más de 15 min" /></div>
        {msg && <p className={'state' + (msg.ok ? '' : ' state-error')} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
        <BulkBar count={sel.size} onClear={() => setSel(new Set())}><Button size="sm" variant="primary" icon={<PfIcon name="refresh" size={14} />} onClick={() => setConfirm(true)}>Reintentar seleccionados</Button><Button size="sm" icon={<Download />} onClick={() => downloadCsv('procesos-seleccion.csv', ['Id', 'Proceso', 'Organización', 'Estado', 'Código'], picked.map((j: Job) => [j.id, j.type, j.organization, j.state, j.errorCode]))}>Exportar selección</Button></BulkBar>
        {confirm && <ConfirmRetry count={picked.length} onCancel={() => setConfirm(false)} onConfirm={run} />}
        <Panel eyebrow="Requieren revisión" title={`Fallidos y atascados (${v.jobs.failed.length})`} lead="No se muestra el contenido ni las entradas de los procesos, solo su estado.">
          <DataTable caption="Procesos fallidos y atascados" rows={v.jobs.failed} columns={cols} rowKey={(j: Job) => j.id} selectable selected={sel} onSelect={setSel} empty={<Empty title="Sin procesos fallidos">No hay procesos fallidos ni atascados.</Empty>} />
        </Panel>
        <Panel eyebrow="Importaciones" title="Importaciones por organización">
          <DataTable caption="Importaciones por organización" rows={v.organizations} rowKey={(o: Org) => o.id} columns={[
            {id: 'o', header: 'Organización', wrap: true, sort: (o: Org) => o.name, cell: (o: Org) => o.name}, {id: 't', header: 'Total', align: 'right', sort: (o: Org) => o.imports.total, cell: (o: Org) => int(o.imports.total)},
            {id: 'op', header: 'En curso', align: 'right', cell: (o: Org) => int(o.imports.open)}, {id: 'f', header: 'Fallidas (30 d)', align: 'right', sort: (o: Org) => o.imports.failed, cell: (o: Org) => int(o.imports.failed)}, {id: 'l', header: 'Última', cell: (o: Org) => fmtDate(o.imports.lastAt)}]} />
        </Panel>
      </>;
    }}
  </Shell>;
}
function ConfirmRetry({count, onCancel, onConfirm}: {count: number; onCancel: () => void; onConfirm: (reason: string) => Promise<void>}) {
  const [reason, setReason] = useState(''), [ok, setOk] = useState(false), [busy, setBusy] = useState(false);
  return <Modal open alert onClose={onCancel} title={'Reintentar ' + count + ' proceso(s)'} describedBy="confirm-desc"
    footer={<><Button data-autofocus onClick={onCancel}>Cancelar</Button><Button variant="primary" loading={busy} disabled={!ok || reason.trim().length < 10} onClick={async () => { setBusy(true); await onConfirm(reason.trim()); setBusy(false); }}>Confirmar reintento</Button></>}>
    <p id="confirm-desc" className="ov-impact">Los procesos fallidos volverán a la cola. No se borra nada y cada reintento queda en la auditoría con tu usuario y el motivo.</p>
    <label className="field">Motivo (obligatorio, mínimo 10 caracteres)<textarea rows={3} value={reason} maxLength={300} onChange={e => setReason(e.target.value)} /></label>
    <label className="pf-check-row"><input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} />Confirmo que quiero reintentar estos procesos.</label>
  </Modal>;
}

// ---------------------------------------------------------------------------------------------- Costos de IA
export function AiCosts({initial}: Props) {
  const ctl = usePlatform(initial);
  return <Shell state={ctl.state} ctl={ctl} title="Costos de IA" description="Gasto del mes por organización frente a su tope. Las proyecciones al cierre son estimadas y lo dicen."
    extra={ctl.state.status === 'ok' ? <Button icon={<Download />} onClick={() => { const v = (ctl.state as {view: PlatformView}).view; downloadCsv('plataforma-costos-ia.csv', ['Organización', 'Gasto', 'Tope', 'Uso del tope', 'Proyección al cierre (Estimado)', 'Reservas sin conciliar'], v.aiCosts.map((c: any) => [c.name, c.spent, c.limit, c.pctBps === null ? 'Sin tope' : pct(c.pctBps), c.projected.display, c.uncertain])); }}>Exportar CSV</Button> : null}>
    {v => {
      const rows = v.aiCosts, cols: Column<(typeof rows)[number]>[] = [
        {id: 'n', header: 'Organización', wrap: true, sort: c => c.name, cell: c => c.name}, {id: 's', header: 'Gasto del mes', align: 'right', sort: c => Number(c.pctBps ?? 0), cell: c => c.spent},
        {id: 'l', header: 'Tope', align: 'right', cell: c => c.limit}, {id: 'p', header: 'Uso del tope', sort: c => c.pctBps, cell: c => <><Meter bps={c.pctBps} /><small className="pf-sub">{pct(c.pctBps)}</small></>},
        {id: 'pr', header: 'Proyección al cierre', align: 'right', cell: c => <>≈ {c.projected.display} <KindBadge kind="estimated" />{c.projected.overLimit && <small className="pf-sub">Superaría el tope</small>}</>},
        {id: 'u', header: 'Sin conciliar', align: 'right', sort: c => c.uncertain, cell: c => int(c.uncertain)}];
      return <>
        <div className="pf-tiles"><Tile label="Gasto total del mes" value={v.kpis.aiSpent} kind="observed" foot={`de ${v.kpis.aiLimit} en topes sumados`}><Meter bps={v.kpis.aiPctBps} /></Tile>
          <Tile label="Organizaciones sobre el 80 %" value={int(rows.filter(c => (c.pctBps ?? 0) >= 8000).length)} kind="observed" foot="Cercanas o sobre su tope" />
          <Tile label="Reservas sin conciliar" value={int(rows.reduce((a, c) => a + c.uncertain, 0))} kind="observed" foot="Inciertas: requieren conciliación del propietario" /></div>
        <Panel eyebrow="Unidades: micro-USD del libro de presupuesto" title="Gasto contra tope por organización" lead="El gasto es lo reservado o conciliado en la ventana vigente de cada organización. Es OpenRouter u otro proveedor según el registro del libro; esta consola no consulta al proveedor.">
          <DataTable caption="Gasto de IA por organización" rows={rows} columns={cols} rowKey={c => c.id} initialSort={{id: 'p', dir: 'desc'}} />
          <HowTo text={rows[0]?.projected.how ?? ''} label="Cómo se calcula la proyección" />
        </Panel>
      </>;
    }}
  </Shell>;
}

// ---------------------------------------------------------------------------------------------- Alertas
export function Alerts({initial}: Props) {
  const ctl = usePlatform(initial), [sev, setSev] = useState('all');
  return <Shell state={ctl.state} ctl={ctl} title="Alertas operativas" description="Estado de organizaciones y señales de plataforma: procesos, topes de IA, statement_timeout, procesos programados y disco. Lo que no tiene fuente conectada se dice, no se oculta.">
    {v => {
      const list = v.alerts.filter((a: any) => sev === 'all' || a.severity === sev);
      return <>
        <form className="pf-filters" onSubmit={e => e.preventDefault()}><Seg label="Severidad" value={sev} options={[{value: 'all', label: 'Todas'}, {value: 'alta', label: 'Altas'}, {value: 'media', label: 'Medias'}, {value: 'info', label: 'Informativas'}]} onChange={setSev} /></form>
        <Panel eyebrow={`${list.length} alerta(s)`} title="Alertas">
          {list.length === 0 ? <Empty title="Sin alertas">No hay alertas con ese filtro.</Empty> : <ul className="pf-list">{list.map((a: any) => <li key={a.id}><div className="pf-li-main"><div className="pf-li-head"><Pill tone={severityTone(a.severity)}>{SEVERITY_LABEL[a.severity]}</Pill><KindBadge kind={a.unknown ? 'unclassified' : 'observed'} /></div><strong>{a.title}</strong><span>{a.organization ?? a.detail}</span>{a.unknown && <span>Para conectarla: el administrador debe habilitar la lectura de {a.source ?? 'la fuente'} (ver NOTAS).</span>}</div>{a.organizationId && <LinkButton href={`/platform/organizaciones?org=${a.organizationId}`} size="sm">Ver organización</LinkButton>}</li>)}</ul>}
        </Panel>
        <Panel eyebrow="Señales de plataforma" title="Estado de la infraestructura"><ul className="pf-list">{v.opsSignals.map((s: any) => <li key={s.kind}><div className="pf-li-main"><div className="pf-li-head"><strong>{s.title}</strong><Pill tone={s.status === 'ok' ? 'ok' : s.status === 'warn' ? 'warn' : s.status === 'crit' ? 'bad' : 'muted'}>{s.status === 'ok' ? 'Normal' : s.status === 'warn' ? 'Atención' : s.status === 'crit' ? 'Crítico' : 'Sin fuente'}</Pill></div><span>{s.detail}</span><span>{s.observedAt ? 'Observado ' + fmtDate(s.observedAt) + ' · ' + s.source : 'Sin observación'}</span></div></li>)}</ul></Panel>
      </>;
    }}
  </Shell>;
}

// ---------------------------------------------------------------------------------------------- Auditoría
export function AuditLog({initial}: Props) {
  const ctl = usePlatform(initial), [op, setOp] = useState('all');
  const audit = ctl.state.status === 'ok' ? ctl.state.view.audit : ctl.state.status === 'partial' ? ctl.state.audit : [];
  const orgs = useMemo(() => (ctl.state.status === 'ok' ? ctl.state.view.organizations : ctl.state.status === 'partial' ? ctl.state.organizations : []) as Array<{id: string; name: string}>, [ctl.state]);
  const rows = audit.filter((a: any) => op === 'all' || a.operation === op);
  const cols: Column<(typeof audit)[number]>[] = [
    {id: 'at', header: 'Fecha', sort: (a: any) => a.createdAt, cell: (a: any) => fmtDate(a.createdAt)}, {id: 'op', header: 'Operación', sort: (a: any) => a.operation, cell: (a: any) => OPERATIONS[a.operation] ?? a.operation},
    {id: 'org', header: 'Organización', wrap: true, cell: (a: any) => orgs.find(o => o.id === a.tenantId)?.name ?? 'Plataforma'}, {id: 'actor', header: 'Actor', cell: (a: any) => <IdChip value={a.actorId} label="Admin" />}, {id: 'id', header: 'Registro', cell: (a: any) => <IdChip value={String(a.id)} />}];
  if (ctl.state.status === 'denied' || ctl.state.status === 'error') return <Shell state={ctl.state} ctl={ctl} title="Auditoría" description="Bitácora de operaciones administrativas.">{() => null}</Shell>;
  return <Shell state={{status: 'ok', synthetic: ctl.state.status === 'ok' && ctl.state.synthetic, view: {generatedAt: new Date().toISOString()} as PlatformView}} ctl={ctl} title="Auditoría" description="Quién hizo qué y cuándo en la administración de plataforma. Solo lectura: la bitácora no se edita ni se borra."
    extra={<Button icon={<Download />} onClick={() => downloadCsv('plataforma-auditoria.csv', ['Id', 'Fecha', 'Operación', 'Organización', 'Actor'], rows.map((a: any) => [a.id, a.createdAt, a.operation, orgs.find(o => o.id === a.tenantId)?.name ?? 'Plataforma', a.actorId]))}>Exportar CSV</Button>}>
    {() => <>
      {ctl.state.status === 'partial' && <p className="pf-banner" role="note"><PfIcon name="info" />Observabilidad no conectada; la auditoría sí está disponible.</p>}
      <form className="pf-filters" onSubmit={e => e.preventDefault()}><label>Operación<select value={op} onChange={e => setOp(e.target.value)}><option value="all">Todas</option>{[...new Set(audit.map((a: any) => a.operation))].map(o => <option key={o as string} value={o as string}>{OPERATIONS[o as string] ?? (o as string)}</option>)}</select></label></form>
      <Panel eyebrow={`${rows.length} registro(s)`} title="Bitácora administrativa"><DataTable caption="Bitácora administrativa" rows={rows} columns={cols} rowKey={(a: any) => String(a.id)} initialSort={{id: 'at', dir: 'desc'}} empty={<Empty title="Sin registros">No hay operaciones con ese filtro.</Empty>} /></Panel>
    </>}
  </Shell>;
}
export {Skeleton};
