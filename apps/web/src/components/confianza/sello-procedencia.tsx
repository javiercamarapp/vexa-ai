import {sello,type ClaseCifra} from '../../lib/confianza/sello.mjs';
import type {Sello} from '../../lib/confianza/sello.mjs';
import './confianza.css';
/** Sello de procedencia de 4 campos bajo una cifra: clase · fuente · hasta fecha · actualizado hace. 11 px gris; el texto completo va también como título (tooltip). */
export function SelloProcedencia({sello:s,clase,fuente,hasta,actualizado,compacto=false}:{sello?:Sello;clase?:ClaseCifra;fuente?:string;hasta?:string|null;actualizado?:string|null;/** dos líneas controladas (clase · fuente / hasta · hace): el texto completo va en el título */compacto?:boolean}){
 const v=s??sello({clase,fuente,hasta,actualizado});
 if(compacto){const h=v.hasta.replace(/ \d{4}$/,''),a=v.actualizado.replace(/^actualizado /,'').replace('sin hora de actualización','sin hora');
  return <p className="sello sello-2" data-clase={v.clase} title={v.texto} aria-label={'Procedencia: '+v.texto}><span className="sello-l1"><span className="sello-clase">{v.claseTxt}</span> · {v.fuente}</span><span className="sello-l2">{h} · {a}</span></p>;}
 return <ul className="sello" data-clase={v.clase} title={v.texto} aria-label={'Procedencia: '+v.texto}><li className="sello-clase">{v.claseTxt}</li><li>{v.fuente}</li><li>{v.hasta}</li><li>{v.actualizado}</li></ul>;
}
