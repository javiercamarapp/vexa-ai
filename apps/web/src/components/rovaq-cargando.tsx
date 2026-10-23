import {RovaqLogo} from './rovaq-logo';

/** Pantalla de carga de Rovaq: el logo animado (el anillo aparece con un barrido y el punto rojo late en su sitio; nunca se separa ni se deforma)
 *  con un texto honesto. Se usa mientras llega la página o los datos. Respeta «reducir movimiento»: sin animación, solo el logo estático. */
export function RovaqCargando({mensaje = 'Cargando…', compacto = false}: {mensaje?: string; compacto?: boolean}) {
  return <div role="status" aria-busy="true" aria-live="polite" className={'rovaq-cargando' + (compacto ? ' rovaq-cargando-compacto' : '')}>
    <RovaqLogo variante={compacto ? 'simbolo' : 'horizontal'} ancho={compacto ? 44 : 168} animado decorativo espacioLibre={false}/>
    {mensaje!==''&&<p className="rovaq-cargando-texto">{mensaje}</p>}
  </div>;
}
