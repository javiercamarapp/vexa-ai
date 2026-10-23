/** The Rovaq mark (same glyph as the app icon). `thinking` adds an orbiting arc and a breathing pulse; both stop under prefers-reduced-motion
 *  and the static ring still tells «working» apart from «idle» without any motion. */
export function RovaqMark({size=24,thinking=false,title}:{size?:number;thinking?:boolean;title?:string}){
 return <span className={'rovaq-mark'+(thinking?' is-thinking':'')} style={{width:size,height:size}} data-state={thinking?'thinking':'idle'}>
  <svg viewBox="-6 -6 76 76" width={size} height={size} role={title?'img':undefined} aria-label={title} aria-hidden={title?undefined:true} focusable="false">
   {thinking&&<circle className="rovaq-orbit" cx="32" cy="32" r="37" fill="none" strokeWidth="3.5" strokeLinecap="round" pathLength={100} strokeDasharray="26 74"/>}
   <g className="rovaq-glyph"><rect width="64" height="64" rx="14" className="rovaq-tile"/><path className="rovaq-r" d="M20 47V17h14.5c6.2 0 10 3.3 10 8.6 0 4.1-2.4 7-6.3 8.1L46 47h-7.6l-6.6-11.4H26.6V47H20Zm6.6-17.2h7.4c2.6 0 4-1.2 4-3.3 0-2.1-1.4-3.2-4-3.2h-7.4v6.5Z"/></g>
  </svg>
 </span>;
}
/** Wordmark used in the chat sidebar and hero: the mark plus the product name, from the same brand as the app shell. */
export function RovaqWordmark({size=28,thinking=false}:{size?:number;thinking?:boolean}){
 return <span className="rovaq-wordmark"><RovaqMark size={size} thinking={thinking}/><span className="rovaq-name">Rovaq <span className="rovaq-ai">AI</span></span></span>;
}
