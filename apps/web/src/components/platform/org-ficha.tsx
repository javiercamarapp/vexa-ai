'use client';
import {useCallback, useRef, useState} from 'react';
import {useAutoRefresh} from '../ui/use-auto-refresh';
import {PageHeader} from '../ui/page-header';
import {LinkButton, Button} from '../ui/button';
import {TeamPanel} from '../team-panel';
import {Empty, Meter, Panel, Pill, Tile, type Tone} from './primitives';
import {OpenOrganizationButton, SupportButton} from './admin-tools';
import {DataTable, type Column} from './data-table';
import {aiUsage, endLabel, opLabel, overallLevel, relative, signals, sourceRows, VENTANA_DIAS, type Freshness, type OrgDetail, type SourceRow} from '../../lib/platform/ficha-model';
import {int as intF, pct as pctF} from '../../../../../packages/cfo-copilot/src/format.mjs';
import {useIdioma, useT} from '../i18n/proveedor';
import {fecha, numero} from '../../lib/i18n/formato';
import type {Clave} from '../../lib/i18n';
import './platform-ui.css';

export type OrgFichaState = {status: 'ok'; detail: OrgDetail} | {status: 'notfound' | 'error'};
const LEVEL_TONE: Record<string, Tone> = {ok: 'ok', warn: 'warn', bad: 'bad', info: 'info'};
const LEVEL_LABEL: Record<string, Clave> = {ok: 'tr.pl.saludable', warn: 'tr.pl.requiereAtencion', bad: 'tr.pl.critica'};
const FRESH_TONE: Record<Freshness, Tone> = {fresh: 'ok', aging: 'warn', stale: 'bad', none: 'muted'};
const FRESH_LABEL: Record<Freshness, Clave> = {fresh: 'tr.pl.frAlDia', aging: 'tr.pl.frEnvejeciendo', stale: 'tr.pl.frAtrasada', none: 'tr.pl.frSinDatos'};
const CONN_LABEL: Record<string, Clave> = {healthy: 'tr.pl.cnSana', running: 'tr.pl.cnSincronizando', partial: 'tr.pl.cnParcial', stale: 'tr.pl.frAtrasada', reconnect_required: 'tr.pl.cnReconexion', active: 'tr.pl.cnActiva', failed: 'tr.pl.cnFallas', disconnected: 'tr.pl.cnDesconectada', disabled: 'tr.pl.cnDeshabilitada'};
const CUT_LABEL: Record<string, Clave> = {published: 'tr.pl.ctPublicado', draft: 'tr.pl.ctBorrador', failed: 'tr.pl.ctFallido'};

/** Ficha 360 de un cliente: solo agregados (estados, conteos, fechas, gasto). Sin correos, mensajes ni cifras de negocio del cliente. */
export function OrgFicha({id, initial}: {id: string; initial: OrgFichaState}) {
  const t = useT(), idioma = useIdioma(), int = (n: number | null | undefined) => intF(n, idioma), pct = (b: number | null | undefined) => pctF(b, idioma);
  const usd = (micro: string) => 'US$ ' + numero(idioma, Number(BigInt(micro) / 10000n) / 100, {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const when = (iso: string | null) => (iso ? fecha(idioma, iso, {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}) + ' UTC' : t('tr.pl.sinRegistro'));
  const whenDia = (iso: string | null) => (iso ? fecha(idioma, iso, {day: 'numeric', month: 'short'}) : t('tr.pl.sinRegistro'));
  const [state, setState] = useState(initial), [team, setTeam] = useState(false), [error, setError] = useState(''), busy = useRef(false);
  const reload = useCallback(async () => {
    busy.current = true;
    try { const r = await fetch(`/platform/data/org/${id}`, {cache: 'no-store', signal: AbortSignal.timeout(20000)}); const j = await r.json(); if (!r.ok && !j.data) throw new Error(); setState(j.data); setError(''); }
    catch { setError(t('tr.pl.errActualizar')); } finally { busy.current = false; }
  }, [id, t]);
  useAutoRefresh(reload, {ocupado: () => busy.current});
  if (state.status !== 'ok') return <div className="pf-page"><PageHeader eyebrow={t('tr.pl.consola')} title={t('tr.pl.fichaTitulo')} description={t('tr.pl.fichaDescCorta')} />
    {state.status === 'notfound' ? <Empty title={t('tr.pl.noExisteOrg')}>{t('tr.pl.noExisteTxt')}</Empty> : <Empty tone="bad" title={t('tr.pl.noDisponible')}>{t('tr.pl.noLeerFicha')}</Empty>}
    <LinkButton href="/platform/organizaciones">{t('tr.pl.volverOrgs')}</LinkButton></div>;
  const d = state.detail, now = Date.parse(d.generatedAt), sig = signals(d, now, t), level = overallLevel(sig), ai = aiUsage(d), rows = sourceRows(d, now, t);
  const client = {id: d.organization.id, name: d.organization.name, member: false};
  const cols: Column<SourceRow>[] = [
    {id: 'src', header: t('tr.pl.fuente'), cell: r => <strong>{r.label}</strong>, sort: r => r.label},
    {id: 'fresh', header: t('tr.pl.frescura'), cell: r => <><Pill tone={FRESH_TONE[r.freshness]}>{t(FRESH_LABEL[r.freshness])}</Pill><small className="pf-sub">{relative(r.lastUpdate, now, t)}</small></>},
    {id: 'rows', header: t('tr.pl.filas'), align: 'right', sort: r => r.total, cell: r => int(r.total)},
    {id: 'inc', header: t('tr.pl.incorporadas'), align: 'right', sort: r => r.incorporatedBps, cell: r => pct(r.incorporatedBps)},
    {id: 'rej', header: t('tr.pl.rechazadas'), align: 'right', sort: r => r.rejected, cell: r => int(r.rejected)},
    {id: 'pen', header: t('tr.pl.pendientes'), align: 'right', sort: r => r.pending, cell: r => int(r.pending)},
    {id: 'conn', header: t('tr.pl.conexion'), cell: r => r.connection ? <>{CONN_LABEL[r.connection.health ?? r.connection.status] ? t(CONN_LABEL[r.connection.health ?? r.connection.status]) : r.connection.status}{r.connection.errorCode && <small className="pf-sub">{r.connection.errorCode}</small>}</> : <span className="muted">{t('tr.pl.sinConexion')}</span>},
  ];
  return <div className="pf-page">
    <PageHeader eyebrow={t('tr.pl.fichaTitulo')} title={d.organization.name} description={t('tr.pl.fichaDesc', {creada: whenDia(d.organization.createdAt), generada: when(d.generatedAt)})}
      actions={<><OpenOrganizationButton id={d.organization.id} /><SupportButton client={client} /><Button onClick={() => setTeam(t => !t)} aria-expanded={team}>{team ? t('tr.pl.ocultarEquipo') : t('tr.pl.gestionarEquipo')}</Button><LinkButton href="/platform/organizaciones">{t('tr.pl.todasOrgsBtn')}</LinkButton></>} />
    {error && <p className="state state-error" role="alert">{error}</p>}
    <div className="pf-tiles pf-tiles-6 reveal">
      <Tile label={t('tr.pl.salud')} value={<Pill tone={LEVEL_TONE[level]}>{t(LEVEL_LABEL[level])}</Pill>} kind="observed" foot={sig.length ? t(sig.length === 1 ? 'tr.pl.nSenal1' : 'tr.pl.nSenales', {n: sig.length}) : t('tr.pl.sinSenales')} />
      <Tile label={t('tr.pl.equipo')} value={int(d.members.total)} kind="observed" foot={t('tr.pl.rolesFoot', {owner: d.members.owner, analyst: d.members.analyst, operator: d.members.operator, viewer: d.members.viewer})} />
      <Tile label={t('tr.pl.asientosLedger')} value={int(d.ledger.rows)} kind="observed" foot={t('tr.pl.ultimoRel', {rel: relative(d.ledger.lastAt, now, t)})} />
      <Tile label={t('tr.pl.procesos30', {dias: VENTANA_DIAS})} value={int(d.jobs.failed30d)} kind="observed" foot={t('tr.pl.procesosFoot', {stuck: d.jobs.stuck, queued: d.jobs.queued, ok: d.jobs.succeeded24h, horas: 24})} />
      <Tile label={t('tr.pl.gastoIaVentana', {ventana: ai.window || t('tr.pl.sinVentana')})} value={usd(ai.spentMicro)} kind="observed" foot={t('tr.pl.deLimitePct', {limit: usd(ai.limitMicro), pct: pct(ai.pctBps)})}><Meter bps={ai.pctBps} /></Tile>
      <Tile label={t('tr.pl.invitaciones')} value={t(d.invitations.pending === 1 ? 'tr.pl.invPendiente1' : 'tr.pl.invPendienteN', {n: d.invitations.pending})} kind="observed" foot={t(d.invitations.expired === 1 ? 'tr.pl.invFoot1' : 'tr.pl.invFootN', {expired: d.invitations.expired, problems: d.invitations.deliveryProblems})} />
    </div>
    {team && <Panel eyebrow={t('tr.pl.equipo')} title={t('tr.pl.gestionarEquipo')} lead={t('tr.pl.equipoLead')}><TeamPanel key={d.organization.id} endpoint={`/api/platform/team?tenantId=${d.organization.id}`} platform /></Panel>}
    <div className="pf-grid-2">
      <Panel eyebrow={t('tr.pl.atencion')} title={t('tr.pl.senales')}>
        {sig.length === 0 ? <Empty title={t('tr.pl.todoEnOrden')}>{t('tr.pl.noMotivos')}</Empty> : <ul className="pf-list">{sig.map((s, i) => <li key={i}><div className="pf-li-main"><div className="pf-li-head"><Pill tone={LEVEL_TONE[s.level]}>{s.level === 'bad' ? t('tr.pl.sevAlta') : s.level === 'warn' ? t('tr.pl.sevMedia') : t('tr.pl.sevInfo')}</Pill></div><span>{s.text}</span></div></li>)}</ul>}
      </Panel>
      <Panel eyebrow={t('tr.pl.cortes')} title={t('tr.pl.ultimosCortes')}>
        {d.cuts.length === 0 ? <Empty title={t('tr.pl.sinCortes')}>{t('tr.pl.sinCortesTxt')}</Empty> : <ul className="pf-list">{d.cuts.map(c => <li key={c.id}><div className="pf-li-main"><div className="pf-li-head"><strong>{CUT_LABEL[c.status] ? t(CUT_LABEL[c.status]) : c.status}</strong></div><span>{c.status === 'published' ? t('tr.pl.cortePublicado', {fecha: when(c.publishedAt)}) : t('tr.pl.corteCreado', {fecha: when(c.createdAt)})}{c.asOf ? ' · ' + t('tr.pl.datosAl', {fecha: whenDia(c.asOf)}) : ''}{c.components !== null ? ' · ' + t(c.components === 1 ? 'tr.pl.componente1' : 'tr.pl.componentesN', {n: int(c.components)}) : ''}</span></div></li>)}</ul>}
      </Panel>
    </div>
    <Panel eyebrow={t('tr.pl.datos')} title={t('tr.pl.saludDatos')} lead={t('tr.pl.frescuraLead', {atrasada: 7, envejeciendo: 2})}>
      {rows.length === 0 ? <Empty title={t('tr.pl.sinFuentes')}>{t('tr.pl.sinFuentesTxt')}</Empty> : <DataTable caption={t('tr.pl.fuentesDatos')} rows={rows} columns={cols} rowKey={r => r.source} pageSize={20} />}
    </Panel>
    <div className="pf-grid-2">
      <Panel eyebrow={t('tr.pl.transparencia')} title={t('tr.pl.entradasSoporte')}>
        {d.support.length === 0 ? <Empty title={t('tr.pl.sinEntradas')}>{t('tr.pl.sinEntradasTxt')}</Empty> : <ul className="pf-list">{d.support.map(s => <li key={s.id}><div className="pf-li-main"><div className="pf-li-head"><strong>{when(s.startedAt)}</strong><Pill tone={s.endedAt ? 'muted' : 'warn'}>{s.endedAt ? endLabel(s.endReason ?? '', t) : t('tr.pl.enCurso')}</Pill></div><span>{t('tr.pl.motivoAdmin', {motivo: s.reason, admin: s.adminId.slice(0, 8)})}</span></div></li>)}</ul>}
      </Panel>
      <Panel eyebrow={t('tr.pl.trazabilidad')} title={t('tr.pl.auditReciente')}>
        {d.audit.length === 0 ? <Empty title={t('tr.pl.sinActividad')} /> : <ul className="pf-list">{d.audit.map((a, i) => <li key={i}><div className="pf-li-main"><strong>{opLabel(a.operation, t)}</strong><span>{when(a.createdAt)} · {t('tr.pl.adminId', {admin: a.actorId.slice(0, 8)})}</span></div></li>)}</ul>}
      </Panel>
    </div>
  </div>;
}
