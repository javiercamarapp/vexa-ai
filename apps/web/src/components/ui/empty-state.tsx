import type {ReactNode} from 'react';
const ART:Record<string,ReactNode>={
 chart:<><rect x="14" y="40" width="10" height="20" rx="3" className="a1"/><rect x="30" y="28" width="10" height="32" rx="3" className="a2"/><rect x="46" y="18" width="10" height="42" rx="3" className="a1"/><path d="M12 64h48" className="ln"/></>,
 inbox:<><path d="M12 38l8-18h32l8 18v18H12V38Z" className="a1"/><path d="M12 38h16l3 6h10l3-6h16" className="ln"/></>,
 plug:<><rect x="22" y="30" width="28" height="20" rx="8" className="a1"/><path d="M29 30V18M43 30V18M36 50v10" className="ln"/></>,
 search:<><circle cx="32" cy="32" r="16" className="a1"/><path d="M44 44l14 14" className="ln"/></>,
 doc:<><path d="M20 12h22l10 10v38H20V12Z" className="a1"/><path d="M42 12v10h10M28 36h16M28 44h16" className="ln"/></>,
 shield:<><path d="M36 10l22 8v16c0 14-9 22-22 28C23 56 14 48 14 34V18l22-8Z" className="a1"/><path d="M26 36l7 7 13-14" className="ln"/></>
};
/** Calm empty/setup/soft-error state: light SVG art, a title, one line, ONE primary action. Absence of data is never shown as a red error. */
export function EmptyState({art='chart',title,body,action,secondary,compact=false,tone='neutral',steps}:{art?:keyof typeof ART|string;title:string;body?:ReactNode;action?:ReactNode;secondary?:ReactNode;compact?:boolean;tone?:'neutral'|'warn';steps?:{done:boolean;label:string}[]}){
 return <div className="empty" data-compact={compact||undefined} data-tone={tone} role="status">
  <svg className="empty-art" viewBox="0 0 72 72" width={compact?48:72} height={compact?48:72} aria-hidden="true"><circle cx="36" cy="36" r="34" className="bg"/>{ART[art]??ART.chart}</svg>
  <h3>{title}</h3>{body&&<p>{body}</p>}
  {steps&&<ol className="empty-steps">{steps.map((s,i)=><li key={i} data-done={s.done||undefined}><span aria-hidden="true">{s.done?'✓':i+1}</span>{s.label}</li>)}</ol>}
  {(action||secondary)&&<div className="empty-actions">{action}{secondary}</div>}
 </div>;
}
