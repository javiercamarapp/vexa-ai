import type {ReactNode} from 'react';
import {Icon} from './icons';
export type Step={key:string;label:string;state:'done'|'current'|'todo';hint?:ReactNode};
/** Lifecycle stepper: dot + label; a step with a hint opens a native details popover. */
export function Stepper({steps,label}:{steps:Step[];label:string}){
 return <ol className="stepper" aria-label={label}>{steps.map((s,i)=><li key={s.key} data-state={s.state} aria-current={s.state==='current'?'step':undefined}>
  <span className="step-dot" aria-hidden="true">{s.state==='done'?<Icon name="check" size={12}/>:i+1}</span>
  {s.hint?<details className="step-pop"><summary>{s.label}</summary><div className="step-hint">{s.hint}</div></details>:<span className="step-label">{s.label}</span>}
 </li>)}</ol>;
}
