import type {ReactNode} from 'react';
/** Tarjeta: padding 16/20, radio 16, borde 1 px, título h2 de 14 px. `bare` = solo el bloque titulado, sin caja (sección). */
export function Card({title,description,actions,children,bare=false,id,as:Tag='section'}:{title?:ReactNode;description?:ReactNode;actions?:ReactNode;children?:ReactNode;bare?:boolean;id?:string;as?:'section'|'article'|'div'}){
 return <Tag className="ui-card" data-bare={bare||undefined} id={id}>
  {(title||actions)&&<header className="ui-card-head"><div className="ui-card-copy">{title&&<h2 className="ui-card-title">{title}</h2>}{description&&<p className="ui-card-desc">{description}</p>}</div>{actions&&<div className="ui-card-actions">{actions}</div>}</header>}
  {children}
 </Tag>;
}
export function Section(p:Omit<Parameters<typeof Card>[0],'bare'>){return <Card {...p} bare/>;}
/** Columna con el ritmo vertical único (24 px) entre bloques. */
export function Stack({children,gap=6}:{children:ReactNode;gap?:3|4|6}){return <div className="ui-stack" data-gap={gap}>{children}</div>;}
