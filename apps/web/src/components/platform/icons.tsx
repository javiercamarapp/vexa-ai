const P: Record<string, string> = {
  sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z',
  building: 'M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16 M14 10h5a1 1 0 0 1 1 1v10 M3 21h18 M8 8h2 M8 12h2 M8 16h2',
  alert: 'M12 3 2 21h20L12 3Z M12 9v5 M12 17h.01',
  database: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Z M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  jobs: 'M4 6h16 M4 12h16 M4 18h10 M18 15l2 2 3-4',
  cpu: 'M9 9h6v6H9z M4 9h2 M4 15h2 M18 9h2 M18 15h2 M9 4v2 M15 4v2 M9 18v2 M15 18v2 M6 6h12v12H6z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z M9 12l2 2 4-4',
  refresh: 'M20 12a8 8 0 1 1-2.6-5.9 M20 4v5h-5',
  download: 'M12 4v11 m-5-5 5 5 5-5 M5 20h14',
  send: 'M4 12 20 4l-4 16-4-7-8-1Z M12 13l8-9',
  close: 'm6 6 12 12 M6 18 18 6',
  chevron: 'm9 6 6 6-6 6',
  info: 'M12 8h.01 M11 12h1v5h1 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  up: 'M12 19V5 M6 11l6-6 6 6',
  down: 'M12 5v14 M6 13l6 6 6-6',
  flat: 'M5 12h14',
  check: 'M5 12l5 5L20 7',
  trend: 'M3 17l6-6 4 4 8-8 M14 7h7v7',
  history: 'M3 11a9 9 0 1 1 3 8 M3 4v7h7 M12 7v5l3 2',
  link: 'M9 15 15 9 M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0 M16 8l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1',
  file: 'M6 3h9l4 4v14H6Z M14 3v5h5 M9 13h7 M9 17h7',
  plus: 'M12 5v14 M5 12h14',
  filter: 'M3 5h18l-7 8v6l-4 2v-8L3 5Z',
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z M5 17a3 3 0 0 1 3-3h11',
};
/** Icono de trazo (mismo estilo que WorkspaceIcon). Decorativo: siempre aria-hidden. */
export function PfIcon({name, size = 16}: {name: keyof typeof P | string; size?: number}) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{(P[name] ?? P.info).split(' M').map((d, i) => <path key={i} d={(i ? 'M' : '') + d} />)}</svg>;
}
