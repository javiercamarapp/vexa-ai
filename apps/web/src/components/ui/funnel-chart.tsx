export type FunnelStage={key:string;label:string;value:number;display:string};
/** Horizontal funnel: band width proportional to the stage count; the step-through percentage sits in a white pill. Exact counts always printed. */
export function FunnelChart({stages,title}:{stages:FunnelStage[];title:string}){
 const top=stages[0]?.value||1;
 return <figure className="funnel" aria-label={title}><ol>{stages.map((s,i)=>{const w=Math.max(4,s.value/top*100),prev=i?stages[i-1].value:null;
  return <li key={s.key}><div className="funnel-label"><span>{s.label}</span><strong>{s.display}</strong>{prev!==null&&prev>0&&<span className="funnel-pill">{(s.value/prev*100).toLocaleString('es-MX',{maximumFractionDigits:1})} % del paso anterior</span>}</div><div className="funnel-track"><span className="funnel-band" style={{width:w+'%',animationDelay:i*70+'ms'}} data-step={i}/></div></li>;})}</ol></figure>;
}
