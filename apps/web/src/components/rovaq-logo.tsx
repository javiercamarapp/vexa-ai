import type {CSSProperties} from 'react';
import {LOGOS, MINIMOS, ROVAQ, espacioLibreEn, type RovaqVariante} from '../../../../packages/workspace-service/marca.mjs';

/** Tono del logotipo. «auto» sigue el tema (positivo en claro, negativo en oscuro) solo con CSS, así que no parpadea ni depende de JavaScript:
 *  respeta `data-theme` y `prefers-color-scheme` igual que el resto de los tokens. «contraste» es el inverso del tema, para pintarlo sobre una superficie de tinta
 *  (p. ej. el botón negro del acceso). «positivo»/«negativo» fijan el tono cuando el fondo no depende del tema. */
export type RovaqTono = 'auto' | 'contraste' | 'positivo' | 'negativo';

const DEFECTO: Record<RovaqVariante, number> = {horizontal: 120, simbolo: 32};

/** Único componente de marca de Rovaq (kit de logotipo): trazos inline, sin fuente. El punto es siempre rojo señal y no se separa del anillo.
 *  Respeta el tamaño mínimo del kit (100 px el horizontal, 16 px el símbolo) y el espacio libre de 2 diámetros del punto (desactívalo solo si el contenedor ya lo da). */
export function RovaqLogo({variante = 'horizontal', tono = 'auto', ancho, espacioLibre = true, decorativo = false, className}: {variante?: RovaqVariante; tono?: RovaqTono; ancho?: number; espacioLibre?: boolean; decorativo?: boolean; className?: string}) {
  const logo = LOGOS[variante], [, , w, h] = logo.viewBox.split(' ').map(Number);
  const width = Math.max(ancho ?? DEFECTO[variante], MINIMOS[variante]), height = Math.round((width * h) / w * 100) / 100;
  const estilo: CSSProperties | undefined = espacioLibre ? {padding: espacioLibreEn(variante, width)} : undefined;
  return <span className={'rovaq-logo rovaq-logo-' + variante + (className ? ' ' + className : '')} data-tono={tono} style={estilo}>
    <svg viewBox={logo.viewBox} width={width} height={height} role={decorativo ? undefined : 'img'} aria-label={decorativo ? undefined : 'Rovaq'} aria-hidden={decorativo ? true : undefined} focusable="false">
      {logo.tinta.map((d, i) => <path key={i} className="rovaq-logo-tinta" fill={ROVAQ.negro} d={d}/>)}
      <circle className="rovaq-logo-punto" fill={ROVAQ.rojo} cx={logo.punto.cx} cy={logo.punto.cy} r={logo.punto.r}/>
    </svg>
  </span>;
}

/** Marca de la barra lateral: logo horizontal expandida, símbolo contraída (la clase `.sidebar-collapsed` alterna cuál se ve). */
export function RovaqLogoLateral() {
  return <>
    <RovaqLogo variante="horizontal" ancho={112} espacioLibre={false} className="rovaq-logo-expandido"/>
    <RovaqLogo variante="simbolo" ancho={28} espacioLibre={false} className="rovaq-logo-colapsado"/>
  </>;
}
