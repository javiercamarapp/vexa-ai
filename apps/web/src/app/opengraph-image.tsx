import {ImageResponse} from 'next/og';
import {LOGOS,ROVAQ} from '../../../../packages/workspace-service/marca.mjs';
import {SITE} from '../lib/site.mjs';
/** Imagen Open Graph 1200×630 con el logotipo real de Rovaq (trazos del kit) sobre fondo claro; se genera en el build, sin costo en ejecución. */
export const alt=SITE.og.alt;
export const size={width:SITE.og.ancho,height:SITE.og.alto};
export const contentType='image/png';
export default function OpenGraphImage(){
 const logo=LOGOS.horizontal,[,,w,h]=logo.viewBox.split(' ').map(Number),ancho=760,alto=Math.round(ancho*h/w);
 return new ImageResponse(
  <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#FFFFFF',color:ROVAQ.negro}}>
   <svg viewBox={logo.viewBox} width={ancho} height={alto}>
    {logo.tinta.map((d:string,i:number)=><path key={i} fill={ROVAQ.negro} d={d}/>)}
    <circle fill={ROVAQ.rojo} cx={logo.punto.cx} cy={logo.punto.cy} r={logo.punto.r}/>
   </svg>
   <div style={{display:'flex',marginTop:56,fontSize:44,fontWeight:600,letterSpacing:-0.5}}>Inteligencia de ingresos para marketplaces</div>
   <div style={{display:'flex',marginTop:16,fontSize:30,color:'#52525B'}}>Detecta fugas, entiende a tus clientes y decide con evidencia</div>
   <div style={{display:'flex',position:'absolute',left:0,bottom:0,width:'100%',height:14,background:ROVAQ.rojo}}/>
  </div>,
  {...size},
 );
}
