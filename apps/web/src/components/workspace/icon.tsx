const paths:Record<string,string>={
 calendar:'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
 overview:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
 problems:'M12 3 2 21h20L12 3Z M12 9v5 M12 17h.01',
 recommendations:'m9 18 6 0 M10 21h4 M8 14a6 6 0 1 1 8 0l-1 2H9Z',
 explorer:'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
 preguntale:'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z',
 interventions:'m4 12 5 5L20 6', briefs:'M6 3h9l4 4v14H6Z M14 3v5h5 M9 12h7 M9 16h7',
 notifications:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
 imports:'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',
 connections:'M9 15 15 9 M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0 M16 8l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
 history:'M3 11a9 9 0 1 1 3 8 M3 4v7h7 M12 7v5l3 2',
 team:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-4',
 settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
 menu:'M4 6h16 M4 12h16 M4 18h16', close:'m6 6 12 12 M6 18 18 6', collapse:'M9 3H3v18h6 M14 8l-4 4 4 4 M10 12h11', expand:'M9 3H3v18h6 M16 8l4 4-4 4 M11 12h9', logout:'M9 4H3v16h6 M14 8l4 4-4 4 M7 12h14',chevron:'m8 10 4 4 4-4',
 avisos:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4 M2 8c0-2 .8-3.6 2-5 M22 8c0-2-.8-3.6-2-5',
 retention:'M3 4h18v4H3z M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8 M10 12h4',
 grid:'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
 clock:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7v5l3 2',
 analysis:'M4 20V10 M10 20V4 M16 20v-8 M22 20V7',economics:'M12 2v20 M17 5H9a4 4 0 0 0 0 8h6a4 4 0 0 1 0 8H5'
};
export function WorkspaceIcon({name}:{name:string}){return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]??paths.briefs}/></svg>;}
