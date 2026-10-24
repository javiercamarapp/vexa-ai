'use client';
import {useCallback, useEffect, useId, useMemo, useRef, useState} from 'react';
import {useRouter} from 'next/navigation';
import {Modal} from '../ui/overlay';
import {Button} from '../ui/button';
import {todosLosItems} from '../../lib/workspace/menu.mjs';
import {buildCommands, pushRecent, rank, readRecents, writeRecents, type ClientItem, type Command} from '../../lib/platform/palette';
import {SUPPORT_MIN_REASON, SUPPORT_MAX_REASON} from '../../lib/platform/support-input';
import './admin-tools.css';

type ClientsPayload = {items: Array<ClientItem & {createdAt: string | null}>; support: {tenantId: string} | null};
const WORKSPACE_SCREENS = todosLosItems().map(({item}: {item: {href: string; etiqueta: string}}) => ({href: item.href, label: item.etiqueta}));
const ERRORS: Record<string, string> = {
  platform_mfa_required: 'Tu cuenta necesita verificación en dos pasos para entrar como cliente. Actívala en «Seguridad de la cuenta».',
  platform_support_active: 'Ya tienes una sesión de soporte abierta. Termínala (botón «Salir» del banner) antes de abrir otra.',
  platform_support_own_organization: 'Ya eres miembro de esa organización: ábrela directamente, no necesitas modo soporte.',
  platform_input_invalid: 'Revisa el motivo (mínimo 10 caracteres) y la duración.',
  platform_access_denied: 'Tu sesión de administrador ya no es válida. Vuelve a iniciar sesión.',
};

/** Selector de cliente + paleta ⌘K para administradores de plataforma. Los datos vienen del servidor; lo guardado en el navegador (recientes) solo ordena la lista. */
export function AdminTools({trigger = true}: {trigger?: boolean}) {
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
    {trigger && <button type="button" className="at-trigger" onClick={() => show('clients')} aria-keyshortcuts="Control+K Meta+K">Cambiar de cliente<kbd className="at-kbd" aria-hidden="true">⌘K</kbd></button>}
    {mode && <CommandList mode={mode} onClose={() => setMode(null)} data={data} failed={failed} recents={recents} onRun={run} />}
    {target && <SupportDialog client={target} onClose={() => setTarget(null)} />}
  </>;
}

function CommandList({mode, onClose, data, failed, recents, onRun}: {mode: 'palette' | 'clients'; onClose: () => void; data: ClientsPayload | null; failed: boolean; recents: string[]; onRun: (c: Command) => Promise<void>}) {
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
  async function activate(c: Command | undefined) { if (!c) return; setError(''); try { await onRun(c); } catch { setError('No se pudo abrir esa organización. Verifica que sigas siendo miembro.'); } }
  const recentSet = new Set(recents);
  return <Modal open onClose={onClose} title={mode === 'clients' ? 'Cambiar de cliente' : 'Ir a…'} subtitle={mode === 'clients' ? 'Busca por nombre. Los recientes aparecen primero.' : 'Clientes, fichas y pantallas. Flechas para moverte, Enter para abrir.'} size="md">
    <div className="at-search"><input type="search" role="combobox" aria-expanded="true" aria-controls={id} aria-activedescendant={shown[sel] ? `${id}-${sel}` : undefined} aria-label="Buscar" placeholder={mode === 'clients' ? 'Nombre del cliente' : 'Cliente o pantalla'} value={q} autoComplete="off"
      onChange={e => { setQ(e.target.value); setSel(0); }}
      onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(shown.length - 1, s + 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)); } else if (e.key === 'Enter') { e.preventDefault(); void activate(shown[sel]); } }} /></div>
    {failed && <p role="alert">No se pudo leer la lista de clientes. Se reintentará al abrir de nuevo.</p>}
    {error && <p role="alert">{error}</p>}
    {!failed && data && shown.length === 0 && <p className="at-vacio" role="status">Nada coincide con «{q}».</p>}
    <ul id={id} role="listbox" aria-label="Resultados" className="at-lista" ref={list}>
      {shown.map((c, i) => <li key={c.id} id={`${id}-${i}`} role="option" aria-selected={i === sel} className="at-fila" onMouseMove={() => setSel(i)} onClick={() => void activate(c)}>
        <span className="at-label">{c.label}</span><small>{c.hint}{'clientId' in c && recentSet.has(c.clientId) ? ' · reciente' : ''}</small>
      </li>)}
    </ul>
  </Modal>;
}

const DURATIONS = [15, 30, 45, 60];
export function SupportButton({client, label = 'Ver como (soporte)'}: {client: ClientItem; label?: string}) {
  const [open, setOpen] = useState(false);
  return <><Button onClick={() => setOpen(true)}>{label}</Button>{open && <SupportDialog client={client} onClose={() => setOpen(false)} />}</>;
}
export function OpenOrganizationButton({id}: {id: string}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function open() {
    setBusy(true); setError('');
    try { const form = new FormData(); form.set('tenant_id', id); const r = await fetch('/auth/organization', {method: 'POST', body: form, signal: AbortSignal.timeout(15000)}); if (!r.ok) throw new Error();
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- cookie de organización cambió
      window.location.assign('/'); } catch { setError('No se pudo abrir la organización.'); setBusy(false); }
  }
  return <><Button variant="primary" loading={busy} onClick={() => void open()}>Abrir organización</Button>{error && <span role="alert">{error}</span>}</>;
}
function SupportDialog({client, onClose}: {client: ClientItem; onClose: () => void}) {
  const [reason, setReason] = useState(''), [minutes, setMinutes] = useState(30), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());
  const ok = reason.trim().length >= SUPPORT_MIN_REASON && reason.trim().length <= SUPPORT_MAX_REASON;
  async function start() {
    if (!ok || busy) return; setBusy(true); setError('');
    try {
      const r = await fetch('/platform/data/support', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({operation: 'start', tenant: client.id, reason: reason.trim(), minutes, requestId}), signal: AbortSignal.timeout(20000)});
      const j = await r.json();
      if (!r.ok) { setError(ERRORS[j?.error?.code] ?? 'No se pudo iniciar el modo soporte. Inténtalo de nuevo.'); setBusy(false); return; }
      // Cambió la organización activa y se creó la marca de soporte: navegación completa.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- cookies de organización y soporte cambiaron
      window.location.assign('/overview');
    } catch { setError('No se pudo iniciar el modo soporte. Inténtalo de nuevo.'); setBusy(false); }
  }
  return <Modal open onClose={onClose} title={`Ver como ${client.name}`} subtitle="Modo soporte: solo lectura" size="md"
    footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button><Button variant="primary" loading={busy} disabled={!ok} onClick={() => void start()}>Iniciar modo soporte</Button></>}>
    <p className="at-aviso">Verás los datos de este cliente como lector. No puedes cambiar nada, exportar ni usar el asistente. Queda registrado quién entró, cuándo y por qué, y la sesión termina sola al vencer.</p>
    <label className="at-campo">Motivo (obligatorio)
      <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={SUPPORT_MAX_REASON} placeholder="Ej.: revisar por qué no cargó HubSpot, ticket de soporte" data-autofocus />
      <small>{reason.trim().length < SUPPORT_MIN_REASON ? `Escribe al menos ${SUPPORT_MIN_REASON} caracteres.` : `${reason.trim().length} de ${SUPPORT_MAX_REASON}`}</small>
    </label>
    <label className="at-campo">Duración
      <select value={minutes} onChange={e => setMinutes(Number(e.target.value))}>{DURATIONS.map(m => <option key={m} value={m}>{m} minutos{m === 60 ? ' (máximo)' : ''}</option>)}</select>
    </label>
    {error && <p role="alert">{error}</p>}
  </Modal>;
}
