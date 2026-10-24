'use client';
import {useCallback, useRef, useState} from 'react';
import {useAutoRefresh} from '../ui/use-auto-refresh';
import {PageHeader} from '../ui/page-header';
import {LinkButton, Button} from '../ui/button';
import {TeamPanel} from '../team-panel';
import {Empty, Meter, Panel, Pill, Tile, type Tone} from './primitives';
import {OpenOrganizationButton, SupportButton} from './admin-tools';
import {DataTable, type Column} from './data-table';
import {aiUsage, END_LABEL, OP_LABEL, overallLevel, relative, signals, sourceRows, type Freshness, type OrgDetail, type SourceRow} from '../../lib/platform/ficha-model';
import {usd} from '../../../../../packages/cfo-copilot/src/client.mjs';
import {int, pct} from '../../../../../packages/cfo-copilot/src/format.mjs';
import './platform-ui.css';

export type OrgFichaState = {status: 'ok'; detail: OrgDetail} | {status: 'notfound' | 'error'};
const LEVEL_TONE: Record<string, Tone> = {ok: 'ok', warn: 'warn', bad: 'bad', info: 'info'};
const LEVEL_LABEL: Record<string, string> = {ok: 'Saludable', warn: 'Requiere atención', bad: 'Crítica'};
const FRESH_TONE: Record<Freshness, Tone> = {fresh: 'ok', aging: 'warn', stale: 'bad', none: 'muted'};
const FRESH_LABEL: Record<Freshness, string> = {fresh: 'Al día', aging: 'Envejeciendo', stale: 'Atrasada', none: 'Sin datos'};
const CONN_LABEL: Record<string, string> = {healthy: 'Sana', running: 'Sincronizando', partial: 'Parcial', stale: 'Atrasada', reconnect_required: 'Requiere reconexión', active: 'Activa', failed: 'Con fallas', disconnected: 'Desconectada', disabled: 'Deshabilitada'};
const CUT_LABEL: Record<string, string> = {published: 'Publicado', draft: 'Borrador', failed: 'Fallido'};
const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat('es-MX', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC'}).format(new Date(iso)) + ' UTC' : 'Sin registro');

/** Ficha 360 de un cliente: solo agregados (estados, conteos, fechas, gasto). Sin correos, mensajes ni cifras de negocio del cliente. */
export function OrgFicha({id, initial}: {id: string; initial: OrgFichaState}) {
  const [state, setState] = useState(initial), [team, setTeam] = useState(false), [error, setError] = useState(''), busy = useRef(false);
  const reload = useCallback(async () => {
    busy.current = true;
    try { const r = await fetch(`/platform/data/org/${id}`, {cache: 'no-store', signal: AbortSignal.timeout(20000)}); const j = await r.json(); if (!r.ok && !j.data) throw new Error(); setState(j.data); setError(''); }
    catch { setError('No se pudo actualizar. Conservo las cifras anteriores; se reintentará solo.'); } finally { busy.current = false; }
  }, [id]);
  useAutoRefresh(reload, {ocupado: () => busy.current});
  if (state.status !== 'ok') return <div className="pf-page"><PageHeader eyebrow="Consola de plataforma" title="Ficha de cliente" description="Estado de un cliente en un vistazo." />
    {state.status === 'notfound' ? <Empty title="No existe esa organización">Verifica el enlace o vuelve a la lista de organizaciones.</Empty> : <Empty tone="bad" title="No disponible">No se pudo leer la ficha. Verifica tu acceso e inténtalo de nuevo.</Empty>}
    <LinkButton href="/platform/organizaciones">Volver a organizaciones</LinkButton></div>;
  const d = state.detail, now = Date.parse(d.generatedAt), sig = signals(d, now), level = overallLevel(sig), ai = aiUsage(d), rows = sourceRows(d, now);
  const client = {id: d.organization.id, name: d.organization.name, member: false};
  const cols: Column<SourceRow>[] = [
    {id: 'src', header: 'Fuente', cell: r => <strong>{r.label}</strong>, sort: r => r.label},
    {id: 'fresh', header: 'Frescura', cell: r => <><Pill tone={FRESH_TONE[r.freshness]}>{FRESH_LABEL[r.freshness]}</Pill><small className="pf-sub">{relative(r.lastUpdate, now)}</small></>},
    {id: 'rows', header: 'Filas', align: 'right', sort: r => r.total, cell: r => int(r.total)},
    {id: 'inc', header: 'Incorporadas', align: 'right', sort: r => r.incorporatedBps, cell: r => pct(r.incorporatedBps)},
    {id: 'rej', header: 'Rechazadas', align: 'right', sort: r => r.rejected, cell: r => int(r.rejected)},
    {id: 'pen', header: 'Pendientes', align: 'right', sort: r => r.pending, cell: r => int(r.pending)},
    {id: 'conn', header: 'Conexión', cell: r => r.connection ? <>{CONN_LABEL[r.connection.health ?? r.connection.status] ?? r.connection.status}{r.connection.errorCode && <small className="pf-sub">{r.connection.errorCode}</small>}</> : <span className="muted">Sin conexión</span>},
  ];
  return <div className="pf-page">
    <PageHeader eyebrow="Ficha de cliente" title={d.organization.name} description={`Creada ${when(d.organization.createdAt).split(',')[0]} · generada ${when(d.generatedAt)}. Solo conteos, estados y gasto: sin contenido del cliente.`}
      actions={<><OpenOrganizationButton id={d.organization.id} /><SupportButton client={client} /><Button onClick={() => setTeam(t => !t)} aria-expanded={team}>{team ? 'Ocultar equipo' : 'Gestionar equipo'}</Button><LinkButton href="/platform/organizaciones">Todas las organizaciones</LinkButton></>} />
    {error && <p className="state state-error" role="alert">{error}</p>}
    <div className="pf-tiles pf-tiles-6 reveal">
      <Tile label="Salud" value={<Pill tone={LEVEL_TONE[level]}>{LEVEL_LABEL[level]}</Pill>} kind="observed" foot={sig.length ? `${sig.length} señal(es)` : 'Sin señales de atención'} />
      <Tile label="Equipo" value={int(d.members.total)} kind="observed" foot={`${d.members.owner} dueño(s) · ${d.members.analyst} analista(s) · ${d.members.operator} operador(es) · ${d.members.viewer} lector(es)`} />
      <Tile label="Asientos del ledger" value={int(d.ledger.rows)} kind="observed" foot={`Último: ${relative(d.ledger.lastAt, now)}`} />
      <Tile label="Procesos (30 días)" value={int(d.jobs.failed30d)} kind="observed" foot={`fallidos · ${d.jobs.stuck} atascados · ${d.jobs.queued} en cola · ${d.jobs.succeeded24h} bien en 24 h`} />
      <Tile label={`Gasto de IA · ${ai.window || 'sin ventana'}`} value={usd(ai.spentMicro)} kind="observed" foot={`de ${usd(ai.limitMicro)} · ${pct(ai.pctBps)}`}><Meter bps={ai.pctBps} /></Tile>
      <Tile label="Invitaciones" value={`${d.invitations.pending} ${d.invitations.pending === 1 ? 'pendiente' : 'pendientes'}`} kind="observed" foot={`${d.invitations.expired} ${d.invitations.expired === 1 ? 'vencida' : 'vencidas'} · ${d.invitations.deliveryProblems} con problema de entrega`} />
    </div>
    {team && <Panel eyebrow="Equipo" title="Gestionar equipo" lead="Leer el equipo de un cliente queda registrado en la auditoría."><TeamPanel key={d.organization.id} endpoint={`/api/platform/team?tenantId=${d.organization.id}`} platform /></Panel>}
    <div className="pf-grid-2">
      <Panel eyebrow="Atención" title="Señales">
        {sig.length === 0 ? <Empty title="Todo en orden">No hay motivos de atención.</Empty> : <ul className="pf-list">{sig.map((s, i) => <li key={i}><div className="pf-li-main"><div className="pf-li-head"><Pill tone={LEVEL_TONE[s.level]}>{s.level === 'bad' ? 'Alta' : s.level === 'warn' ? 'Media' : 'Informativa'}</Pill></div><span>{s.text}</span></div></li>)}</ul>}
      </Panel>
      <Panel eyebrow="Cortes" title="Últimos cortes">
        {d.cuts.length === 0 ? <Empty title="Sin cortes">Todavía no se ha preparado ningún corte.</Empty> : <ul className="pf-list">{d.cuts.map(c => <li key={c.id}><div className="pf-li-main"><div className="pf-li-head"><strong>{CUT_LABEL[c.status] ?? c.status}</strong></div><span>{c.status === 'published' ? `Publicado ${when(c.publishedAt)}` : `Creado ${when(c.createdAt)}`}{c.asOf ? ` · datos al ${when(c.asOf).split(',')[0]}` : ''}{c.components !== null ? ` · ${int(c.components)} componentes` : ''}</span></div></li>)}</ul>}
      </Panel>
    </div>
    <Panel eyebrow="Datos" title="Salud de datos y frescura" lead="Una fuente «atrasada» no recibió datos en más de 7 días; «envejeciendo», en más de 2.">
      {rows.length === 0 ? <Empty title="Sin fuentes">Aún no hay cargas ni conexiones.</Empty> : <DataTable caption="Fuentes de datos" rows={rows} columns={cols} rowKey={r => r.source} pageSize={20} />}
    </Panel>
    <div className="pf-grid-2">
      <Panel eyebrow="Transparencia" title="Entradas de soporte">
        {d.support.length === 0 ? <Empty title="Sin entradas">Nadie de Rovaq ha entrado como este cliente.</Empty> : <ul className="pf-list">{d.support.map(s => <li key={s.id}><div className="pf-li-main"><div className="pf-li-head"><strong>{when(s.startedAt)}</strong><Pill tone={s.endedAt ? 'muted' : 'warn'}>{s.endedAt ? (END_LABEL[s.endReason ?? ''] ?? 'Terminó') : 'En curso'}</Pill></div><span>Motivo: {s.reason} · administrador {s.adminId.slice(0, 8)}</span></div></li>)}</ul>}
      </Panel>
      <Panel eyebrow="Trazabilidad" title="Auditoría reciente de este cliente">
        {d.audit.length === 0 ? <Empty title="Sin actividad" /> : <ul className="pf-list">{d.audit.map((a, i) => <li key={i}><div className="pf-li-main"><strong>{OP_LABEL[a.operation] ?? a.operation}</strong><span>{when(a.createdAt)} · administrador {a.actorId.slice(0, 8)}</span></div></li>)}</ul>}
      </Panel>
    </div>
  </div>;
}
