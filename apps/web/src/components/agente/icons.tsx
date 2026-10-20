const P:Record<string,string>={
 spark:'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z',
 send:'M12 19V5 M5 12l7-7 7 7', stop:'M7 7h10v10H7z', search:'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
 history:'M3 11a9 9 0 1 1 3 8 M3 4v7h7 M12 7v5l3 2', plus:'M12 5v14 M5 12h14', copy:'M9 9h11v11H9z M5 15V5a1 1 0 0 1 1-1h10', check:'M5 12l5 5L20 7',
 sheet:'M4 4h16v16H4z M4 10h16 M10 4v16', download:'M12 4v11m-5-5 5 5 5-5M5 20h14', refresh:'M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5',
 up:'M7 11v9H4v-9h3Z M7 11l4-8a2 2 0 0 1 3 2v4h5a2 2 0 0 1 2 2l-1 6a2 2 0 0 1-2 2H7', down:'M7 13V4H4v9h3Z M7 13l4 8a2 2 0 0 0 3-2v-4h5a2 2 0 0 0 2-2l-1-6a2 2 0 0 0-2-2H7',
 arrow:'M5 12h14M13 6l6 6-6 6', alert:'M12 3 2 21h20L12 3Z M12 9v5 M12 17h.01', info:'M12 8h.01 M11 12h1v5h1 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0', lock:'M6 11h12v10H6z M8 11V7a4 4 0 0 1 8 0v4',
 edit:'M4 20h4L19 9l-4-4L4 16v4Z', trash:'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13', close:'m6 6 12 12 M6 18 18 6',
};
export function Icon({name,size=16}:{name:keyof typeof P|string;size?:number}){return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[name]??P.info}/></svg>;}
