// Vista de /sin-acceso (componente de servidor). Administrador de plataforma sin organizaciones: aviso claro y enlace a la consola; esta pantalla no tiene recorrido guiado.
import {InvitacionesPendientes, type Invitacion, type InvitacionVencida} from './sin-acceso';
import {LinkButton} from './ui/button';
import {Notice} from './ui/notice';
import type {Traductor} from '../lib/i18n';
export function SinAccesoVista({inv, isAdmin, t}: {inv: {pending: Invitacion[]; expired: InvitacionVencida[]}; isAdmin: boolean; t: Traductor}) {
  return <section className="home access-flow acceso-sistema" aria-labelledby="sa-titulo">
    <h1 id="sa-titulo">{inv.pending.length ? t('sinacceso.tituloInvitacion') : t('sinacceso.titulo')}</h1>
    {isAdmin && <Notice>{t('onb.ui.superadminSinOrg')}</Notice>}
    {inv.pending.length > 0 && <InvitacionesPendientes invitaciones={inv.pending} />}
    {inv.pending.length === 0 && inv.expired.length > 0 && <>
      <Notice tone="warn">{t('sinacceso.vencida')}</Notice>
      <ul className="sa-lista">{inv.expired.map((e, i) => <li key={i} className="card sa-tarjeta"><div><strong>{e.organization}</strong><small>{t('sinacceso.rol', {rol: e.role})}</small></div></li>)}</ul>
    </>}
    {inv.pending.length === 0 && inv.expired.length === 0 && !isAdmin && <Notice>{t('sinacceso.nada')}</Notice>}
    <div className="sa-acciones">
      {isAdmin && <LinkButton href="/platform" variant="primary">{t('sinacceso.irConsola')}</LinkButton>}
      <form action="/auth/logout" method="post"><button className="btn btn-secondary" type="submit">{t('sinacceso.cerrarSesion')}</button></form>
    </div>
  </section>;
}
