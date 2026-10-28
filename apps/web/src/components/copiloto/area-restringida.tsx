import {LinkButton, Arrow} from '../ui/button';
import {useT} from '../i18n/proveedor';
import type {Clave} from '../../lib/i18n';
import type {Modo} from '../../lib/copiloto/modos.mjs';
import './copiloto.css';
/** Estado «sin acceso» del copiloto de negocio: mismo shell sin encabezado, un solo h1, sin cifras ni datos. */
export function AreaRestringida({modo}: {modo: Modo}) {
  const t = useT(), roles = (modo.rolesPermitidos as readonly string[]).map(r => (['owner', 'analyst', 'operator', 'viewer'].includes(r) ? t(('cop.rol.' + r) as Clave) : r));
  const lista = roles.length > 1 ? roles.slice(0, -1).join(', ') + t('cop.y') + roles[roles.length - 1] : roles[0];
  const titulo = ['cfo', 'refunds', 'general'].includes(modo.clave) ? t(('cop.modo.' + modo.clave) as Clave) : modo.titulo;
  return <div className="cn-gate" role="status"><h1>{t('cop.soloPara', {roles: lista})}</h1><p>{t('cop.restringida', {modo: titulo})}</p><LinkButton href="/overview" icon={<Arrow />}>{t('cop.volverResumen')}</LinkButton></div>;
}
