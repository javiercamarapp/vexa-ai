'use client';
import {useCallback, useEffect, useId, useMemo, useRef, useState} from 'react';
import {useRouter} from 'next/navigation';
import {Modal} from '../ui/overlay';
import {Button} from '../ui/button';
import {todosLosItems} from '../../lib/workspace/menu.mjs';
import {buildCommands, pushRecent, rank, readRecents, writeRecents, type ClientItem, type Command} from '../../lib/platform/palette';
import {SUPPORT_MIN_REASON, SUPPORT_MAX_REASON} from '../../lib/platform/support-input';
import './admin-tools.css';
import {useT} from '../i18n/proveedor';
import type {Clave} from '../../lib/i18n';

type ClientsPayload = {items: Array<ClientItem & {createdAt: string | null}>; support: {tenantId: string} | null};
const WORKSPACE_SCREENS = todosLosItems().map(({item}: {item: {href: string; etiqueta: string}}) => ({href: item.href, label: item.etiqueta}));
const ERRORS: Record<string, Clave> = {
  platform_mfa_required: 'tr.pf.atMfa',
  platform_support_active: 'tr.pf.atActiva',
  platform_support_own_organization: 'tr.pf.atPropia',
  platform_input_invalid: 'tr.pf.atInput',
  platform_access_denied: 'tr.pf.atDenegado',
};

/** Selector de cliente + paleta ⌘K para administradores de plataforma. Los datos vienen del servidor; lo guardado en el navegador (recientes) solo ordena la lista. */
export function AdminTools({trigger = true}: {trigger?: boolean}) {
  const t = useT();
  const router = useRouter(), [mode, setMode] = useState<null | 'palette' | 'clients'>(null), [data, setData] = useState<ClientsPayload | null>(null), [failed, setFailed] = useState(false);
  const [target, setTarget] = useState<ClientItem | null>(null), [recents, setRecents] = useState<string[]>([]), modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; });
  const load = useCallback(async () => {
    try { const r = await fetch('/platform/data/clients', {cache: 'no-store', signal: AbortSignal.timeout(15000)}); const j = await r.json(); if (!r.ok) throw new Error(); setData(j.data); setFailed(false); }
    catch { setFailed(true); }
  }, []);
  const show = useCallback((m: 'palette' | 'clients') => { setRecents(readRecents(typeof localStorage === 'undefined' ? null : localStorage)); setMode(m); void load(); }, [load]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (modeRef.current) setMode(null); else show('palette'); } };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [show]);
  async function openOrganization(id: string) {
    const form = new FormData(); form.set('tenant_id', id);
    const r = await fetch('/auth/organization', {method: 'POST', body: form, signal: AbortSignal.timeout(15000)});
    if (!r.ok) throw new Error('organization_not_authorized');
    // Cambió la organización activa: se descarta el caché de navegación.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- cookie de organización cambió
    window.location.assign('/');
  }
  async function run(c: Command) {
    if ('clientId' in c) { const next = pushRecent(recents, c.clientId); setRecents(next); writeRecents(typeof localStorage === 'undefined' ? null : localStorage, next); }
    if (c.kind === 'screen' || c.kind === 'client-file') { setMode(null); router.push(c.href); return; }
    if (c.kind === 'client-open') { await openOrganization(c.clientId); return; }
    const client = data?.items.find(i => i.id === c.clientId); if (client) { setMode(null); setTarget(client); }
  }
  return <>
    {trigger && <button type="button" className="at-trigger" onClick={() => show('clients')} aria-keyshortcuts="Control+K Meta+K">{t('tr.pf.cambiarCliente')}<kbd className="at-kbd" aria-hidden="true">⌘K</kbd></button>}
    {mode && <CommandList mode={mode} onClose={() => setMode(null)} data={data} failed={failed} recents={recents} onRun={run} />}
    {target && <SupportDialog client={target} onClose={() => setTarget(null)} />}
  </>;
}

function CommandList({mode, onClose, data, failed, recents, onRun}: {mode: 'palette' | 'clients'; onClose: () => void; data: ClientsPayload | null; failed: boolean; recents: string[]; onRun: (c: Command) => Promise<void>}) {
  const t = useT();
  const [q, setQ] = useState(''), [sel, setSel] = useState(0), [error, setError] = useState(''), id = useId(), list = useRef<HTMLUListElement>(null);
  const commands = useMemo(() => {
    const all = buildCommands(data?.items ?? [], WORKSPACE_SCREENS, data?.support != null);
    return mode === 'clients' ? all.filter(c => 'clientId' in c) : all;
  }, [data, mode]);
  const shown = useMemo(() => {
    const ranked = rank(commands, q, recents);
    if (mode === 'clients' && !q.trim()) return [...ranked].sort((a, b) => (recents.indexOf('clientId' in a ? a.clientId : '') + 1 || 99) - (recents.indexOf('clientId' in b ? b.clientId : '') + 1 || 99)).slice(0, 40);
    return ranked.slice(0, 40);
  }, [commands, q, recents, mode]);
  useEffect(() => { list.current?.querySelector('[aria-selected=true]')?.scrollIntoView?.({block: 'nearest'}); }, [sel]);
  async function activate(c: Command | undefined) { if (!c) return; setError(''); try { await onRun(c); } catch { setError(t('tr.pf.noAbrirOrg')); } }
  const recentSet = new Set(recents);
  return <Modal open onClose={onClose} title={mode === 'clients' ? t('tr.pf.cambiarCliente') : t('tr.pf.irA')} subtitle={mode === 'clients' ? t('tr.pf.buscaNombre') : t('tr.pf.paletaSub')} size="md">
    <div className="at-search"><input type="search" role="combobox" aria-expanded="true" aria-controls={id} aria-activedescendant={shown[sel] ? `${id}-${sel}` : undefined} aria-label={t('tr.pf.buscar')} placeholder={mode === 'clients' ? t('tr.pf.nombreCliente') : t('tr.pf.clienteOPantalla')} value={q} autoComplete="off"
      onChange={e => { setQ(e.target.value); setSel(0); }}
      onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(shown.length - 1, s + 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)); } else if (e.key === 'Enter') { e.preventDefault(); void activate(shown[sel]); } }} /></div>
    {failed && <p role="alert">{t('tr.pf.noLista')}</p>}
    {error && <p role="alert">{error}</p>}
    {!failed && data && shown.length === 0 && <p className="at-vacio" role="status">{t('tr.pf.nadaCoincide', {q})}</p>}
    <ul id={id} role="listbox" aria-label={t('tr.pf.resultados')} className="at-lista" ref={list}>
      {shown.map((c, i) => <li key={c.id} id={`${id}-${i}`} role="option" aria-selected={i === sel} className="at-fila" onMouseMove={() => setSel(i)} onClick={() => void activate(c)}>
        <span className="at-label">{c.label}</span><small>{c.hint}{'clientId' in c && recentSet.has(c.clientId) ? t('tr.pf.reciente') : ''}</small>
      </li>)}
    </ul>
  </Modal>;
}

const DURATIONS = [15, 30, 45, 60];
export function SupportButton({client, label}: {client: ClientItem; label?: string}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return <><Button onClick={() => setOpen(true)}>{label ?? t('tr.pf.verComo')}</Button>{open && <SupportDialog client={client} onClose={() => setOpen(false)} />}</>;
}
export function OpenOrganizationButton({id}: {id: string}) {
  const t = useT();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function open() {
    setBusy(true); setError('');
    try { const form = new FormData(); form.set('tenant_id', id); const r = await fetch('/auth/organization', {method: 'POST', body: form, signal: AbortSignal.timeout(15000)}); if (!r.ok) throw new Error();
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- cookie de organización cambió
      window.location.assign('/'); } catch { setError(t('tr.pf.noAbrirOrgBtn')); setBusy(false); }
  }
  return <><Button variant="primary" loading={busy} onClick={() => void open()}>{t('tr.pf.abrirOrg')}</Button>{error && <span role="alert">{error}</span>}</>;
}
function SupportDialog({client, onClose}: {client: ClientItem; onClose: () => void}) {
  const t = useT();
  const [reason, setReason] = useState(''), [minutes, setMinutes] = useState(30), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());
  const ok = reason.trim().length >= SUPPORT_MIN_REASON && reason.trim().length <= SUPPORT_MAX_REASON;
  async function start() {
    if (!ok || busy) return; setBusy(true); setError('');
    try {
      const r = await fetch('/platform/data/support', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({operation: 'start', tenant: client.id, reason: reason.trim(), minutes, requestId}), signal: AbortSignal.timeout(20000)});
      const j = await r.json();
      if (!r.ok) { setError(t(ERRORS[j?.error?.code] ?? 'tr.pf.noModoSoporte', {n: SUPPORT_MIN_REASON})); setBusy(false); return; }
      // Cambió la organización activa y se creó la marca de soporte: navegación completa.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- cookies de organización y soporte cambiaron
      window.location.assign('/overview');
    } catch { setError(t('tr.pf.noModoSoporte')); setBusy(false); }
  }
  return <Modal open onClose={onClose} title={t('tr.pf.verComoNombre', {name: client.name})} subtitle={t('tr.pf.modoSoporteSub')} size="md"
    footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>{t('tr.pf.cancelar')}</Button><Button variant="primary" loading={busy} disabled={!ok} onClick={() => void start()}>{t('tr.pf.iniciarSoporte')}</Button></>}>
    <p className="at-aviso">{t('tr.pf.avisoSoporte')}</p>
    <label className="at-campo">{t('tr.pf.motivoOblig')}
      <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={SUPPORT_MAX_REASON} placeholder={t('tr.pf.motivoEj')} data-autofocus />
      <small>{reason.trim().length < SUPPORT_MIN_REASON ? t('tr.pf.minChars', {n: SUPPORT_MIN_REASON}) : t('tr.pf.nDeM', {n: reason.trim().length, m: SUPPORT_MAX_REASON})}</small>
    </label>
    <label className="at-campo">{t('tr.pf.duracion')}
      <select value={minutes} onChange={e => setMinutes(Number(e.target.value))}>{DURATIONS.map(m => <option key={m} value={m}>{m === 60 ? t('tr.pf.minutosMax', {m}) : t('tr.pf.minutos', {m})}</option>)}</select>
    </label>
    {error && <p role="alert">{error}</p>}
  </Modal>;
}
