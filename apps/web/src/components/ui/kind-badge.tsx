import {KINDS,SIN_DATOS,epistemicKind,type KindOrNoData} from '../../lib/epistemic.mjs';
const glyph:Record<KindOrNoData,string>={nodata:'M6 12h12',observed:'M5 12l5 5L20 7',estimated:'M4 18 L10 8 L14 14 L20 5',inferred:'M5 12h4m6 0h4M9 12a3 3 0 0 0 6 0',unclassified:'M9 9a3 3 0 1 1 4 3c-1 .6-1 1.2-1 2M12 18h.01'};
/** Observado / Estimado / Inferido: icon + text + pattern, never color alone. */
export function KindBadge({kind,metric,hint}:{kind?:KindOrNoData;metric?:{kind?:string;status?:string};hint?:string}){
 const k=kind??epistemicKind(metric),info=k==='nodata'?SIN_DATOS:KINDS[k];
 return <span className={'kind-badge kind-'+k} title={hint??info.hint}><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={glyph[k]}/></svg>{info.label}</span>;
}
