import type {ReactNode} from 'react';
import {guia,type GuiaId} from '../../lib/legibilidad/guias.mjs';
import {Popover} from './overlay';
import {Icon} from './icons';
import {MovilContenido} from './movil-contenido';
import s from './legibilidad.module.css';
/** Una línea guía bajo el título (qué se ve y de dónde sale) y, si la vista tiene guía, un «¿Cómo leer esto?» en popover.
 *  `guide` toma el texto de lib/legibilidad/guias.mjs; `description` solo se usa si no hay guía. */
export function PageHeader({eyebrow,title,description,actions,guide,linea,nivel=1}:{nivel?:1|2;eyebrow?:string;title:string;description?:ReactNode;actions?:ReactNode;guide?:GuiaId;linea?:string}){
 const g=guide?guia(guide):null;
 return <header className="page-header"><div className="page-header-copy">{eyebrow&&<p className="eyebrow">{eyebrow}</p>}{nivel===2?<h2>{title}</h2>:<h1>{title}</h1>}
  {g?<div className={s.guideRow}><p className={'page-header-description '+s.guideLine} style={{margin:0}}>{linea??g.linea}</p>
    <Popover label={'¿Cómo leer '+g.titulo+'?'} width={340} triggerClassName="btn btn-ghost btn-sm" trigger={<><Icon name="info" size={14}/><span className="btn-label">¿Cómo leer esto?</span></>}>
     <h2 className={s.guideTitle}>¿Cómo leer esto?</h2><ul className={s.guideList}>{g.como.map((t,i)=><li key={i}>{t}</li>)}</ul>
    </Popover></div>
   :description&&<p className="page-header-description">{description}</p>}</div>{actions&&<div className="page-header-actions">{actions}</div>}<MovilContenido/></header>;
}
