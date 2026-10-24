/** Modelo puro de la paleta ⌘K y del selector de clientes: ordenar, filtrar y recordar recientes. Sin DOM ni red, para probarlo. */
export type ClientItem = {id: string; name: string; member: boolean};
export type Screen = {href: string; label: string};
export type Command =
  | {id: string; kind: 'screen'; label: string; hint: string; href: string}
  | {id: string; kind: 'client-file'; label: string; hint: string; href: string; clientId: string}
  | {id: string; kind: 'client-open'; label: string; hint: string; clientId: string}
  | {id: string; kind: 'client-view-as'; label: string; hint: string; clientId: string};
export const RECENTS_KEY = 'vexa_clientes_recientes', RECENTS_MAX = 5;
/** Minúsculas sin acentos, para que «Mérida» se encuentre con «merida». */
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const PLATFORM_SCREENS: Screen[] = [
  {href: '/platform', label: 'Resumen de plataforma'}, {href: '/platform/organizaciones', label: 'Organizaciones'}, {href: '/platform/fuentes', label: 'Fuentes y cargas'},
  {href: '/platform/procesos', label: 'Procesos'}, {href: '/platform/costos-ia', label: 'Costos de IA'}, {href: '/platform/alertas', label: 'Alertas'}, {href: '/platform/auditoria', label: 'Auditoría'},
  {href: '/seguridad', label: 'Seguridad de la cuenta (MFA)'},
];
export function buildCommands(clients: readonly ClientItem[], workspaceScreens: readonly Screen[], inSupport: boolean): Command[] {
  const out: Command[] = [];
  for (const c of clients) {
    out.push({id: 'f:' + c.id, kind: 'client-file', label: `Ficha de ${c.name}`, hint: 'Cliente · ficha 360', href: `/platform/organizaciones/${c.id}`, clientId: c.id});
    if (c.member) out.push({id: 'o:' + c.id, kind: 'client-open', label: `Abrir ${c.name}`, hint: 'Cliente · tu organización', clientId: c.id});
    else if (!inSupport) out.push({id: 'v:' + c.id, kind: 'client-view-as', label: `Ver como ${c.name}`, hint: 'Cliente · soporte, solo lectura', clientId: c.id});
  }
  for (const s of PLATFORM_SCREENS) out.push({id: 'p:' + s.href, kind: 'screen', label: s.label, hint: 'Plataforma', href: s.href});
  for (const s of workspaceScreens) out.push({id: 'w:' + s.href, kind: 'screen', label: s.label, hint: 'Espacio de trabajo', href: s.href});
  return out;
}
/** Todas las palabras de la búsqueda deben aparecer; empiezan-con primero, luego recientes, luego orden alfabético estable. */
export function rank(commands: readonly Command[], query: string, recents: readonly string[] = []): Command[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  const recentRank = (c: Command) => { const id = 'clientId' in c ? c.clientId : ''; const i = recents.indexOf(id); return i < 0 ? 99 : i; };
  const scored = commands.map((c, i) => ({c, i, text: norm(c.label)})).filter(x => words.every(w => x.text.includes(w)));
  const starts = (x: {text: string}) => (words.length && words.every(w => x.text.split(/\s+/).some(t => t.startsWith(w))) ? 0 : 1);
  return scored.sort((a, b) => starts(a) - starts(b) || recentRank(a.c) - recentRank(b.c) || a.i - b.i).map(x => x.c);
}
export function pushRecent(list: readonly string[], id: string): string[] { return [id, ...list.filter(x => x !== id)].slice(0, RECENTS_MAX); }
/** Solo una comodidad del navegador: el servidor valida SIEMPRE. Cualquier fallo de almacenamiento = lista vacía. */
export function readRecents(storage: Pick<Storage, 'getItem'> | null | undefined): string[] {
  try { const v = JSON.parse(storage?.getItem(RECENTS_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)).slice(0, RECENTS_MAX) : []; } catch { return []; }
}
export function writeRecents(storage: Pick<Storage, 'setItem'> | null | undefined, list: readonly string[]): void { try { storage?.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, RECENTS_MAX))); } catch { /* sin almacenamiento: no pasa nada */ } }
