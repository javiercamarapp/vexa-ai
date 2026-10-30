import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {IDENTITY, VIGENCIA, renderLayout} from '../../packages/notifications/email-system.mjs';
import {catalogEn, renderEn, renderTextEn, managementPatchEn} from './templates-en.mjs';

// Trece correos de Supabase Auth (seis acciones y siete avisos de seguridad) con el sistema de diseño de
// CORREOS-DISENO.md. Solo variables Go documentadas por Supabase; nada de user_metadata salvo en la
// invitación (`.Data.*`, con respaldo `or`/`if` cuando no existe). Supabase Auth solo acepta HTML: los .txt de
// `supabase/templates/auth/texto/` son la versión de texto plano para el día que los envíe el hook «Send Email».
const ANTI = 'Rovaq nunca te pedirá tu contraseña por correo.';
const LOGIN = '[{{ .SiteURL }}/login]({{ .SiteURL }}/login)';
const support = `[${IDENTITY.supportEmail}](mailto:${IDENTITY.supportEmail})`;
const security = `[${IDENTITY.securityEmail}](mailto:${IDENTITY.securityEmail})`;
const copyUrl = {type: 'urlLine', lead: 'Si el botón no abre, copia esta dirección en tu navegador:', url: '{{ .ConfirmationURL }}'};
const button = label => ({type: 'button', label, href: '{{ .ConfirmationURL }}'});
const caduca = `El enlace caduca en ${VIGENCIA.enlace} y solo funciona una vez.`;

const actions = [
  {
    id: 'magic_link', subject: 'Tu enlace para entrar a Rovaq', vars: ['.ConfirmationURL', '.Email', '.SiteURL'],
    preheader: 'Úsalo en la próxima hora. Solo funciona una vez.',
    eyebrow: 'Acceso', h1: 'Entra a Rovaq con este enlace',
    blocks: [
      {type: 'p', text: 'Pediste entrar a Rovaq con el correo **{{ .Email }}**. Usa el botón; no necesitas contraseña.'},
      button('Entrar a Rovaq'),
      {type: 'help', text: `${caduca} Si ya no sirve, pide uno nuevo en ${LOGIN}.`},
    ],
    note: [{type: 'help', text: '¿No pediste este acceso? Ignora este correo; sin el enlace nadie puede entrar a tu cuenta. No reenvíes este mensaje.'}, copyUrl],
    footer: {strong: ANTI, extra: 'No compartas este enlace con nadie.', motive: 'Recibes este correo porque se solicitó un acceso con esta dirección en Rovaq.'},
  },
  {
    id: 'reauthentication', subject: 'Tu código de verificación de Rovaq', vars: ['.Token', '.Email'],
    preheader: `Vale ${VIGENCIA.codigo}. Solo escríbelo en la pantalla de Rovaq.`,
    eyebrow: 'Verificación', h1: 'Confirma que eres tú',
    blocks: [
      {type: 'p', text: 'Escribe este código en la pantalla de Rovaq donde lo pediste.'},
      {type: 'code', text: '{{ .Token }}'},
      {type: 'help', text: `Vale ${VIGENCIA.codigo} y se usa una sola vez.`},
    ],
    note: [{type: 'help', text: '¿No lo pediste? No hagas nada y cambia tu contraseña; alguien podría tener acceso a tu sesión. Ni siquiera Rovaq te pedirá este código.'}],
    footer: {strong: ANTI, extra: 'No compartas este código con nadie, ni siquiera con Rovaq.', motive: 'Recibes este correo porque una acción de seguridad en tu cuenta lo requiere.'},
  },
  {
    id: 'confirmation', subject: 'Confirma tu correo en Rovaq', vars: ['.ConfirmationURL', '.Email', '.SiteURL'],
    preheader: `Un paso para activar tu cuenta. El enlace caduca en ${VIGENCIA.enlace}.`,
    eyebrow: 'Cuenta', h1: 'Confirma tu correo',
    blocks: [
      {type: 'p', text: 'Se creó una cuenta de Rovaq con **{{ .Email }}**. Confirma que esta dirección es tuya para activarla.'},
      button('Confirmar mi correo'),
      {type: 'help', text: `${caduca} Si ya no sirve, pide uno nuevo desde la pantalla de acceso.`},
    ],
    note: [{type: 'help', text: '¿No creaste esta cuenta? Ignora este correo; sin confirmar, no se activa.'}, copyUrl],
    footer: {strong: ANTI, extra: 'No reenvíes este mensaje.', motive: 'Recibes este correo porque alguien registró esta dirección en Rovaq.'},
  },
  {
    id: 'recovery', subject: 'Restablece el acceso a Rovaq', vars: ['.ConfirmationURL', '.Email', '.SiteURL'],
    preheader: 'Elige una contraseña nueva en la próxima hora.',
    eyebrow: 'Acceso', h1: 'Restablece tu contraseña',
    blocks: [
      {type: 'p', text: 'Pediste recuperar el acceso a la cuenta **{{ .Email }}**. Con el botón podrás elegir una contraseña nueva (mínimo 12 caracteres).'},
      button('Elegir contraseña nueva'),
      {type: 'help', text: `${caduca} Si ya no sirve, pide uno nuevo en ${LOGIN}.`},
    ],
    note: [{type: 'help', text: `¿No lo pediste? Ignora este correo; tu contraseña actual sigue funcionando. Si recibes varios, avísanos en ${security}.`}, copyUrl],
    footer: {strong: ANTI, extra: 'No reenvíes este mensaje.', motive: 'Recibes este correo porque se pidió recuperar el acceso con esta dirección.'},
  },
  {
    id: 'email_change', subject: 'Confirma tu nuevo correo en Rovaq', vars: ['.ConfirmationURL', '.Email', '.NewEmail'],
    preheader: `Confirma solo si pediste el cambio. Caduca en ${VIGENCIA.enlace}.`,
    eyebrow: 'Cuenta', h1: 'Confirma tu nuevo correo',
    blocks: [
      {type: 'list', rows: [{label: 'Correo actual', value: '{{ .Email }}'}, {label: 'Correo nuevo', value: '{{ .NewEmail }}'}]},
      {type: 'p', text: 'Si confirmas, entrarás a Rovaq con el correo nuevo. Te avisaremos también en el correo actual.'},
      button('Confirmar el cambio'),
      {type: 'help', text: caduca},
    ],
    note: [{type: 'help', text: `¿No pediste este cambio? No abras el enlace y avísanos en ${security}; protegeremos tu cuenta.`}, copyUrl],
    footer: {strong: ANTI, extra: 'No reenvíes este mensaje.', motive: 'Recibes este correo porque se pidió cambiar el correo de una cuenta de Rovaq.'},
  },
  {
    id: 'invite', subject: 'Te invitaron a un espacio en Rovaq', vars: ['.ConfirmationURL', '.Email', '.SiteURL', '.Data.invita', '.Data.espacio', '.Data.rol', '.Data.rol_funcion', '.Data.rol_descripcion', '.Data.vence'],
    preheader: 'Acepta la invitación para entrar al equipo. Es personal y no se reenvía.',
    eyebrow: 'Invitación al equipo', h1: '{{ or .Data.invita "Una persona" }} te invitó a {{ or .Data.espacio "un espacio" }}',
    blocks: [
      {type: 'p', text: 'Podrás {{ or .Data.rol_funcion "colaborar con tu equipo" }}{{ if .Data.rol }}, con el rol de **{{ .Data.rol }}**{{ end }}.'},
      {type: 'list', rows: [
        {label: 'Espacio', value: '{{ .Data.espacio }}', when: '.Data.espacio'},
        {label: 'Rol', value: '{{ .Data.rol }}{{ if .Data.rol_descripcion }} · {{ .Data.rol_descripcion }}{{ end }}', when: '.Data.rol'},
        {label: 'Invitó', value: '{{ .Data.invita }}', when: '.Data.invita'},
        {label: 'Vence', value: '{{ .Data.vence }}', when: '.Data.vence'},
      ]},
      button('Aceptar invitación'),
      {type: 'help', text: 'Si todavía no tienes cuenta, la crearás al aceptar. Puedes rechazar la invitación sin consecuencias; basta con ignorar este correo.'},
    ],
    note: [{type: 'help', text: `¿No conoces a {{ or .Data.invita "quien te invita" }} o no esperabas esto? No abras el enlace y avísanos en ${support}.`}, copyUrl],
    footer: {strong: ANTI, extra: 'El enlace es personal; no lo reenvíes.', motive: 'Recibes este correo porque {{ or .Data.invita "una persona" }} escribió esta dirección al invitar personas a {{ or .Data.espacio "su espacio" }}.'},
  },
];

const noticeHelp = `Para cualquier duda, escribe a ${security}. No incluyas contraseñas ni códigos en tu mensaje.`;
const notices = [
  ['password_changed', 'La contraseña de tu cuenta cambió', 'Si no fuiste tú, escríbenos hoy para proteger tu cuenta.', 'Se cambió la contraseña de la cuenta **{{ .Email }}**.', ['.Email'], 'revoke'],
  ['email_changed', 'El correo de tu cuenta cambió', 'Si no fuiste tú, actúa hoy: escríbenos para proteger tu cuenta.', 'El correo de acceso de tu cuenta de Rovaq se cambió. Revisa que los datos sean los que esperas.', ['.Email'], 'revoke'],
  ['phone_changed', 'El teléfono de tu cuenta cambió', 'Si no fuiste tú, escríbenos hoy para proteger tu cuenta.', 'El teléfono de verificación de la cuenta **{{ .Email }}** se cambió.', ['.Email'], 'revoke'],
  ['identity_linked', 'Se vinculó un método de acceso', 'Se añadió {{ .Provider }} a tu cuenta. Revisa que haya sido tú.', 'Se añadió **{{ .Provider }}** como forma de entrar a tu cuenta.', ['.Provider', '.Email'], 'review'],
  ['identity_unlinked', 'Se desvinculó un método de acceso', 'Se quitó {{ .Provider }} de tu cuenta. Revisa que haya sido tú.', 'Se quitó **{{ .Provider }}** como forma de entrar a tu cuenta.', ['.Provider', '.Email'], 'review'],
  ['mfa_factor_enrolled', 'Se agregó una verificación en dos pasos', 'Ahora te pediremos un segundo paso al entrar a Rovaq.', 'Se activó **{{ .FactorType }}** como segundo paso al entrar.', ['.FactorType', '.Email'], 'revoke'],
  ['mfa_factor_unenrolled', 'Se quitó una verificación en dos pasos', 'Tu cuenta quedó con menos protección. Revisa que haya sido tú.', 'Se desactivó **{{ .FactorType }}**; tu cuenta quedó con menos protección.', ['.FactorType', '.Email'], 'revoke'],
].map(([event, subject, preheader, detail, vars, kind]) => {
  const withUrl = !!IDENTITY.revokeUrl;
  const callout = withUrl
    ? (kind === 'revoke' ? 'Revoca el cambio ahora. Cerraremos todas las sesiones abiertas y te pediremos verificar tu identidad.' : 'Quita el acceso desde Configuración > Seguridad y cierra las sesiones abiertas.')
    : `Escríbenos de inmediato a ${security}. Revisaremos tu cuenta y, si hace falta, cerraremos las sesiones abiertas.`;
  return {
    id: event + '_notification', event, notice: true, subject, vars, preheader,
    eyebrow: 'Aviso de seguridad', h1: subject,
    blocks: [
      {type: 'p', text: detail},
      {type: 'callout', title: 'Si no fuiste tú', body: callout},
      ...(withUrl ? [{type: 'button', label: kind === 'revoke' ? 'Revocar este cambio' : 'Revisar mi seguridad', href: IDENTITY.revokeUrl}] : []),
      {type: 'help', text: 'Si fuiste tú, no necesitas hacer nada.'},
    ],
    note: [{type: 'help', text: noticeHelp}],
    footer: {strong: ANTI, motive: 'Te enviamos este aviso porque cambió un dato de seguridad de tu cuenta. No se puede desactivar.'},
  };
});

export const catalog = [...actions, ...notices].map(item => Object.freeze(item));

/** Acciones de plantilla Go permitidas además de las variables de `vars`. */
export const GO_ACTIONS = Object.freeze(['or', 'if', 'end']);

const layoutArgs = item => ({go: true, assetOrigin: IDENTITY.assetOrigin, subject: item.subject, preheader: item.preheader, eyebrow: item.eyebrow, h1: item.h1, blocks: item.blocks, note: item.note, footer: item.footer});
export const render = item => renderLayout(layoutArgs(item)).html;
export const renderText = item => renderLayout(layoutArgs(item)).text;

export function managementPatch() {
  const patch = {};
  for (const item of catalog) { patch['mailer_subjects_' + item.id] = item.subject; patch['mailer_templates_' + item.id + '_content'] = render(item); if (item.notice) patch['mailer_notifications_' + item.event + '_enabled'] = true; }
  return patch;
}
export function localConfig() { return catalog.map(item => `[auth.email.${item.notice ? 'notification.' + item.event : 'template.' + item.id}]\n${item.notice ? 'enabled = true\n' : ''}subject = ${JSON.stringify(item.subject)}\ncontent_path = "./supabase/templates/auth/${item.id}.html"`).join('\n\n') + '\n'; }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  if (process.argv[2] === '--write') {
    const dir = path.join(root, 'supabase/templates/auth');
    fs.mkdirSync(path.join(dir, 'texto'), {recursive: true});
    for (const item of catalog) { fs.writeFileSync(path.join(dir, item.id + '.html'), render(item)); fs.writeFileSync(path.join(dir, 'texto', item.id + '.txt'), renderText(item)); }
    // Juego en ingles (alternativo; no esta referenciado por config.toml ni aplicado en Supabase).
    fs.mkdirSync(path.join(dir, 'en', 'texto'), {recursive: true});
    for (const item of catalogEn) { fs.writeFileSync(path.join(dir, 'en', item.id + '.html'), renderEn(item)); fs.writeFileSync(path.join(dir, 'en', 'texto', item.id + '.txt'), renderTextEn(item)); }
  } else if (process.argv[2] === '--management-patch') process.stdout.write(JSON.stringify(process.argv[3] === '--lang=en' ? managementPatchEn() : managementPatch(), null, 2) + '\n');
  else if (process.argv[2] === '--local-config') process.stdout.write(localConfig());
  else throw new Error('Use --write, --management-patch [--lang=en] or --local-config. This tool never sends mail or changes remote configuration.');
}
