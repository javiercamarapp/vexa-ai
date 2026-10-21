import type {ReactNode} from 'react';
/** Ring progress 0–1. The centre shows the exact label passed in (never a rounded stand-in for a count). */
export function ProgressRing({value,size=44,stroke=5,label,tone='observed',title}:{value:number;size?:number;stroke?:number;label?:ReactNode;tone?:'observed'|'estimated'|'inferred'|'neutral';title:string}){
 const v=Math.max(0,Math.min(1,value)),r=(size-stroke)/2;
 return <span className="ring" style={{width:size,height:size}} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v*100)} aria-label={title}>
  <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true"><circle cx={size/2} cy={size/2} r={r} className="ring-track" strokeWidth={stroke} fill="none"/><circle cx={size/2} cy={size/2} r={r} className="ring-fill" data-tone={tone} strokeWidth={stroke} fill="none" strokeLinecap="round" pathLength={100} strokeDasharray={`${v*100} 100`} transform={`rotate(-90 ${size/2} ${size/2})`}/></svg>
  {label!==undefined&&<span className="ring-label">{label}</span>}
 </span>;
}
/** Barcode-style progress strip: 40 ticks, filled ones coloured. Use at most twice per screen. */
export function TickBar({value,ticks=40,title,tone='observed'}:{value:number;ticks?:number;title:string;tone?:'observed'|'estimated'|'inferred'|'neutral'}){
 const filled=Math.round(Math.max(0,Math.min(1,value))*ticks);
 return <span className="ticks" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value*100)} aria-label={title}>{Array.from({length:ticks},(_,i)=><i key={i} data-on={i<filled||undefined} data-tone={tone} style={{animationDelay:i*8+'ms'}}/>)}</span>;
}
