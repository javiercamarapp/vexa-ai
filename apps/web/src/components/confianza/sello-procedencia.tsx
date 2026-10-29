'use client';
import {sello,type ClaseCifra} from '../../lib/confianza/sello.mjs';
import type {Sello} from '../../lib/confianza/sello.mjs';
import {useT} from '../i18n/proveedor';
import './confianza.css';
/** Sello de procedencia de 4 campos bajo una cifra: clase · fuente · hasta fecha · actualizado hace. 11 px gris; el texto completo va también como título (tooltip). El texto se redacta aquí con el idioma activo a partir de los datos crudos del sello. */
export function SelloProcedencia({sello:s,clase,fuente,hasta,actualizado,compacto=false}:{sello?:Sello;clase?:ClaseCifra;fuente?:string;hasta?:string|null;actualizado?:string|null;/** dos líneas controladas (clase · fuente / hasta · hace): el texto completo va en el título */compacto?:boolean}){
 const t=useT();
 const v=s?sello({clase:s.clase,fuente:s.fuenteCruda,hasta:s.hastaIso,actualizado:s.actualizadoIso,ahora:s.ahora,t}):sello({clase,fuente,hasta,actualizado,t});
 const aria=t('conf.procedencia',{texto:v.texto});
 if(compacto)return <p className="sello sello-2" data-clase={v.clase} title={v.texto} aria-label={aria}><span className="sello-l1"><span className="sello-clase">{v.claseTxt}</span> · {v.fuente}</span><span className="sello-l2">{v.hastaCorto} · {v.actualizadoCorto}</span></p>;
 return <ul className="sello" data-clase={v.clase} title={v.texto} aria-label={aria}><li className="sello-clase">{v.claseTxt}</li><li>{v.fuente}</li><li>{v.hasta}</li><li>{v.actualizado}</li></ul>;
}
