import type {ReactNode} from 'react';
export function PageHeader({eyebrow,title,description,actions}:{eyebrow?:string;title:string;description?:ReactNode;actions?:ReactNode}){
 return <header className="page-header"><div className="page-header-copy">{eyebrow&&<p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description&&<p className="page-header-description">{description}</p>}</div>{actions&&<div className="page-header-actions">{actions}</div>}</header>;
}
