'use client';
import {useRef,type KeyboardEvent} from 'react';
/** Single-choice segmented control (radiogroup, arrow keys). Active segment is white on a soft track so it never competes with the primary button. */
export function SegmentedControl<T extends string>({options,value,onChange,label,size='md'}:{options:{value:T;label:string;count?:number}[];value:T;onChange:(v:T)=>void;label:string;size?:'sm'|'md'}){
 const ref=useRef<HTMLDivElement>(null);
 const move=(e:KeyboardEvent,i:number)=>{const d=e.key==='ArrowRight'||e.key==='ArrowDown'?1:e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:0;if(!d)return;e.preventDefault();const next=options[(i+d+options.length)%options.length];onChange(next.value);requestAnimationFrame(()=>ref.current?.querySelector<HTMLElement>('[aria-checked=true]')?.focus());};
 return <div className="segmented" data-size={size} role="radiogroup" aria-label={label} ref={ref}>{options.map((o,i)=><button key={o.value} type="button" role="radio" className="seg-btn" aria-checked={o.value===value} tabIndex={o.value===value?0:-1} onClick={()=>onChange(o.value)} onKeyDown={e=>move(e,i)}>{o.label}{o.count!==undefined&&<span className="seg-count">{o.count}</span>}</button>)}</div>;
}
