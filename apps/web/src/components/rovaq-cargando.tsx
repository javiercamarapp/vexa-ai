import {RovaqLogo} from './rovaq-logo';

/** Pantalla de carga de Rovaq = la de Likida: SOLO el logo, centrado, que «respira» (opacidad .35→1, escala .985→1, 1.6 s, easeOutQuint). Sin texto visible
 *  (el mensaje solo lo lee el lector de pantalla) y sin barridos que recorten el logo. Sin movimiento (prefers-reduced-motion): logo estático. */
export function RovaqCargando({mensaje = 'Cargando…', compacto = false}: {mensaje?: string; compacto?: boolean}) {
  return <div role="status" aria-busy="true" aria-live="polite" aria-label={mensaje || 'Cargando'} className={'rovaq-cargando' + (compacto ? ' rovaq-cargando-compacto' : '')}>
    <RovaqLogo variante={compacto ? 'simbolo' : 'horizontal'} ancho={compacto ? 36 : 140} className="rovaq-respira" decorativo espacioLibre={false}/>
  </div>;
}
