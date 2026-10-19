import {KINDS,epistemicKind,type EpistemicKind} from '../../lib/epistemic.mjs';
const glyph:Record<EpistemicKind,string>={observed:'M5 12l5 5L20 7',estimated:'M4 18 L10 8 L14 14 L20 5',inferred:'M5 12h4m6 0h4M9 12a3 3 0 0 0 6 0',unclassified:'M9 9a3 3 0 1 1 4 3c-1 .6-1 1.2-1 2M12 18h.01'};
/** Observado / Estimado / Inferido: icon + text + pattern, never color alone. */
export function KindBadge({kind,metric}:{kind?:EpistemicKind;metric?:{kind?:string;status?:string}}){
 const k=kind??epistemicKind(metric);
 return <span className={'kind-badge kind-'+k} title={KINDS[k].hint}><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={glyph[k]}/></svg>{KINDS[k].label}</span>;
}
