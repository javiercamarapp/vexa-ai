import type {ReactNode} from 'react';
import {Icon} from './icons';
export type TimelineEvent={key:string;title:ReactNode;meta?:ReactNode;body?:ReactNode;icon?:string;change?:{from:string;to:string};actions?:ReactNode};
/** Vertical event timeline; each event is a small card, with an optional “Anterior → Actual” change line. */
export function Timeline({events}:{events:TimelineEvent[]}){
 return <ol className="timeline">{events.map(e=><li key={e.key}><span className="tl-dot" aria-hidden="true"><Icon name={e.icon??'message'} size={13}/></span><div className="tl-card"><div className="tl-head"><strong>{e.title}</strong>{e.meta&&<span className="tl-meta">{e.meta}</span>}</div>{e.change&&<p className="tl-change"><span>{e.change.from}</span><Icon name="arrow-right" size={12}/><strong>{e.change.to}</strong></p>}{e.body&&<div className="tl-body">{e.body}</div>}{e.actions&&<div className="tl-actions">{e.actions}</div>}</div></li>)}</ol>;
}
