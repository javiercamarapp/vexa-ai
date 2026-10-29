// Imagen social 1200 por 630, una por idioma (/og/es.png y /og/en.png), generada con next/og en el build: costo de ejecución cero.
// Marco de la marca: fondo de tinta, logotipo negativo con su punto rojo (único rojo), el titular de la portada y su segunda frase. Sin cifras ni afirmaciones nuevas.
import {ImageResponse} from 'next/og';
import {LOGOS, ROVAQ} from '../../../../../../../packages/workspace-service/marca.mjs';
import {LANDING} from '../../../../content/sitio/landing';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return [{archivo: 'es.png'}, {archivo: 'en.png'}];
}

export async function GET(_req: Request, {params}: {params: Promise<{archivo: string}>}) {
  const {archivo} = await params;
  const lang = archivo === 'es.png' ? 'es' : archivo === 'en.png' ? 'en' : null;
  if (!lang) return new Response('No encontrado', {status: 404});
  const logo = LOGOS.horizontal;
  const [, , w, h] = logo.viewBox.split(' ').map(Number);
  const ancho = 520;
  const alto = Math.round((ancho * h) / w);
  // Titular: lo que sigue a la barra del título de pestaña de la portada. Segunda frase: la que sigue en la descripción.
  const titular = LANDING.seo.pagina.titulo[lang].split(' | ')[1] ?? LANDING.seo.pagina.titulo[lang];
  const apoyo = LANDING.seo.pagina.descripcion[lang].split('. ')[1] ?? '';
  return new ImageResponse(
    (
      <div style={{width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '72px 80px', background: ROVAQ.negro, color: '#F4F2EF'}}>
        <svg viewBox={logo.viewBox} width={ancho} height={alto}>
          {logo.tinta.map((d: string, i: number) => <path key={i} fill="#FFFFFF" d={d} />)}
          <circle fill={ROVAQ.rojo} cx={logo.punto.cx} cy={logo.punto.cy} r={logo.punto.r} />
        </svg>
        <div style={{display: 'flex', flexDirection: 'column'}}>
          <div style={{display: 'flex', fontSize: 76, fontWeight: 300, lineHeight: 1.08, letterSpacing: -1.5}}>{titular}</div>
          <div style={{display: 'flex', marginTop: 28, fontSize: 32, color: '#A1A1AA'}}>{apoyo}</div>
        </div>
      </div>
    ),
    {width: 1200, height: 630},
  );
}
