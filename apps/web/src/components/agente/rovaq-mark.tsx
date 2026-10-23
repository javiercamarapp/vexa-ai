import {RovaqLogo} from '../rovaq-logo';
/** El símbolo de Rovaq (kit de logotipo, tinta según tema). `thinking` dibuja, por fuera y sin tocar el símbolo, un arco que orbita; se detiene bajo prefers-reduced-motion
 *  y el anillo estático sigue distinguiendo «trabajando» de «en reposo» sin necesidad de movimiento. */
export function RovaqMark({size=24,thinking=false,title}:{size?:number;thinking?:boolean;title?:string}){
 const lado=Math.max(size,16),simbolo=Math.max(Math.round(lado*(thinking?.66:1)),16);
 return <span className={'rovaq-mark'+(thinking?' is-thinking':'')} style={{width:lado,height:lado}} data-state={thinking?'thinking':'idle'} title={title}>
  {thinking&&<svg className="rovaq-orbit-svg" viewBox="-6 -6 76 76" width={lado} height={lado} aria-hidden="true" focusable="false"><circle className="rovaq-orbit" cx="32" cy="32" r="30" fill="none" strokeWidth="3.5" strokeLinecap="round" pathLength={100} strokeDasharray="26 74"/></svg>}
  <RovaqLogo variante="simbolo" ancho={simbolo} espacioLibre={false} decorativo={!title}/>
 </span>;
}
/** Logotipo de la portada y la barra del chat: el logo horizontal del kit (ya incluye el nombre; no se le agrega texto). */
export function RovaqWordmark({size=28}:{size?:number;thinking?:boolean}){
 return <span className="rovaq-wordmark"><RovaqLogo variante="horizontal" ancho={Math.round(size*4)} espacioLibre={false}/></span>;
}
