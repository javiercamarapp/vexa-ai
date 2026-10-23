import {LinkButton, Arrow} from '../ui/button';
import {textoSoloPara} from '../../lib/copiloto/modos.mjs';
import type {Modo} from '../../lib/copiloto/modos.mjs';
import './copiloto.css';
/** Estado «sin acceso» del copiloto de negocio: mismo shell sin encabezado, un solo h1, sin cifras ni datos. */
export function AreaRestringida({modo}: {modo: Modo}) {
  return <div className="cn-gate" role="status"><h1>{textoSoloPara(modo)}</h1><p>«{modo.titulo}» muestra dinero del negocio. Pídele acceso a un propietario de tu espacio de trabajo.</p><LinkButton href="/overview" icon={<Arrow />}>Volver al resumen</LinkButton></div>;
}
