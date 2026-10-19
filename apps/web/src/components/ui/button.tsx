import Link from '../workspace/navigation-lifecycle';
import type {ButtonHTMLAttributes,ReactNode} from 'react';
type Variant='primary'|'secondary'|'ghost';
type Size='sm'|'md';
const cls=(variant:Variant,size:Size,extra?:string)=>['btn','btn-'+variant,size==='sm'?'btn-sm':'',extra??''].filter(Boolean).join(' ');
/** One primary action per zone; everything else secondary or ghost. `loading` blocks double submits and announces busy. */
export function Button({variant='secondary',size='md',loading=false,icon,children,className,disabled,type='button',...rest}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:Variant;size?:Size;loading?:boolean;icon?:ReactNode}){
 return <button {...rest} type={type} className={cls(variant,size,className)} disabled={disabled||loading} aria-busy={loading||undefined}>{loading?<span className="btn-spinner" aria-hidden="true"/>:icon}<span className="btn-label">{children}</span></button>;
}
/** A link that looks and behaves like an intentional action (icon, 36 px target, focus ring). */
export function LinkButton({href,variant='secondary',size='md',icon,children,className,download,...rest}:{href:string;variant?:Variant;size?:Size;icon?:ReactNode;children:ReactNode;className?:string;download?:string}&Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>,'href'|'className'|'download'>){
 if(download!==undefined)return <a {...rest} href={href} download={download} className={cls(variant,size,className)}>{icon}<span className="btn-label">{children}</span></a>;
 return <Link {...rest} href={href} className={cls(variant,size,className)}>{icon}<span className="btn-label">{children}</span></Link>;
}
export const Arrow=()=> <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
export const Download=()=> <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg>;
export const Refresh=()=> <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/></svg>;
