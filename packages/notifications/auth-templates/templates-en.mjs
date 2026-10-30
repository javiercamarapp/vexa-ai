import {IDENTITY, OTP_EXPIRY_SECONDS, renderLayout} from '../../packages/notifications/email-system.mjs';

// Version en ingles de los trece correos de Supabase Auth. Misma estructura, mismas variables Go y mismo diseno que
// templates.mjs (espanol, el que esta en produccion). Supabase solo admite UNA plantilla por tipo: este juego es la
// alternativa para un proyecto en ingles o para el dia en que el correo salga por el hook «Send Email» y se elija por
// idioma. Nada de esto esta aplicado en Supabase. Una prueba mantiene sincronizadas ambas versiones.
const HOUR = OTP_EXPIRY_SECONDS === 3600 ? '1 hour' : `${Math.round(OTP_EXPIRY_SECONDS / 60)} minutes`;
const ANTI = 'Rovaq will never ask for your password by email.';
const LOGIN = '[{{ .SiteURL }}/login]({{ .SiteURL }}/login)';
const support = `[${IDENTITY.supportEmail}](mailto:${IDENTITY.supportEmail})`;
const security = `[${IDENTITY.securityEmail}](mailto:${IDENTITY.securityEmail})`;
const copyUrl = {type: 'urlLine', lead: 'If the button does not open, copy this address into your browser:', url: '{{ .ConfirmationURL }}'};
const button = label => ({type: 'button', label, href: '{{ .ConfirmationURL }}'});
const expires = `The link expires in ${HOUR} and works only once.`;

const actions = [
  {
    id: 'magic_link', subject: 'Your link to sign in to Rovaq', vars: ['.ConfirmationURL', '.Email', '.SiteURL'],
    preheader: 'Use it within the next hour. It works only once.',
    eyebrow: 'Access', h1: 'Sign in to Rovaq with this link',
    blocks: [
      {type: 'p', text: 'You asked to sign in to Rovaq with **{{ .Email }}**. Use the button; you do not need a password.'},
      button('Sign in to Rovaq'),
      {type: 'help', text: `${expires} If it no longer works, request a new one at ${LOGIN}.`},
    ],
    note: [{type: 'help', text: 'Did not ask for this? Ignore this email; nobody can enter your account without the link. Do not forward this message.'}, copyUrl],
    footer: {strong: ANTI, extra: 'Do not share this link with anyone.', motive: 'You are receiving this email because a sign-in was requested with this address in Rovaq.'},
  },
  {
    id: 'reauthentication', subject: 'Your Rovaq verification code', vars: ['.Token', '.Email'],
    preheader: `Valid for ${HOUR}. Just type it on the Rovaq screen.`,
    eyebrow: 'Verification', h1: 'Confirm it is you',
    blocks: [
      {type: 'p', text: 'Type this code on the Rovaq screen where you asked for it.'},
      {type: 'code', text: '{{ .Token }}'},
      {type: 'help', text: `It is valid for ${HOUR} and can be used only once.`},
    ],
    note: [{type: 'help', text: 'Did not ask for it? Do nothing and change your password; someone might have access to your session. Not even Rovaq will ask you for this code.'}],
    footer: {strong: ANTI, extra: 'Do not share this code with anyone, not even with Rovaq.', motive: 'You are receiving this email because a security action on your account requires it.'},
  },
  {
    id: 'confirmation', subject: 'Confirm your email in Rovaq', vars: ['.ConfirmationURL', '.Email', '.SiteURL'],
    preheader: `One step to activate your account. The link expires in ${HOUR}.`,
    eyebrow: 'Account', h1: 'Confirm your email',
    blocks: [
      {type: 'p', text: 'A Rovaq account was created with **{{ .Email }}**. Confirm that this address is yours to activate it.'},
      button('Confirm my email'),
      {type: 'help', text: `${expires} If it no longer works, request a new one from the sign-in screen.`},
    ],
    note: [{type: 'help', text: 'Did not create this account? Ignore this email; it is not activated unless you confirm.'}, copyUrl],
    footer: {strong: ANTI, extra: 'Do not forward this message.', motive: 'You are receiving this email because someone registered this address in Rovaq.'},
  },
  {
    id: 'recovery', subject: 'Reset your Rovaq access', vars: ['.ConfirmationURL', '.Email', '.SiteURL'],
    preheader: 'Choose a new password within the next hour.',
    eyebrow: 'Access', h1: 'Reset your password',
    blocks: [
      {type: 'p', text: 'You asked to recover access to the account **{{ .Email }}**. The button lets you choose a new password (at least 12 characters).'},
      button('Choose a new password'),
      {type: 'help', text: `${expires} If it no longer works, request a new one at ${LOGIN}.`},
    ],
    note: [{type: 'help', text: `Did not ask for it? Ignore this email; your current password still works. If you receive several, let us know at ${security}.`}, copyUrl],
    footer: {strong: ANTI, extra: 'Do not forward this message.', motive: 'You are receiving this email because access recovery was requested with this address.'},
  },
  {
    id: 'email_change', subject: 'Confirm your new email in Rovaq', vars: ['.ConfirmationURL', '.Email', '.NewEmail'],
    preheader: `Confirm only if you asked for the change. It expires in ${HOUR}.`,
    eyebrow: 'Account', h1: 'Confirm your new email',
    blocks: [
      {type: 'list', rows: [{label: 'Current email', value: '{{ .Email }}'}, {label: 'New email', value: '{{ .NewEmail }}'}]},
      {type: 'p', text: 'If you confirm, you will sign in to Rovaq with the new email. We will also notify the current email.'},
      button('Confirm the change'),
      {type: 'help', text: expires},
    ],
    note: [{type: 'help', text: `Did not ask for this change? Do not open the link and tell us at ${security}; we will protect your account.`}, copyUrl],
    footer: {strong: ANTI, extra: 'Do not forward this message.', motive: 'You are receiving this email because a change of email was requested for a Rovaq account.'},
  },
  {
    id: 'invite', subject: 'You were invited to a workspace in Rovaq', vars: ['.ConfirmationURL', '.Email', '.SiteURL', '.Data.invita', '.Data.espacio', '.Data.rol', '.Data.rol_funcion', '.Data.rol_descripcion', '.Data.vence'],
    preheader: 'Accept the invitation to join the team. It is personal and cannot be forwarded.',
    eyebrow: 'Team invitation', h1: '{{ or .Data.invita "Someone" }} invited you to {{ or .Data.espacio "a workspace" }}',
    blocks: [
      {type: 'p', text: 'You will be able to {{ or .Data.rol_funcion "collaborate with your team" }}{{ if .Data.rol }}, with the role of **{{ .Data.rol }}**{{ end }}.'},
      {type: 'list', rows: [
        {label: 'Workspace', value: '{{ .Data.espacio }}', when: '.Data.espacio'},
        {label: 'Role', value: '{{ .Data.rol }}{{ if .Data.rol_descripcion }} · {{ .Data.rol_descripcion }}{{ end }}', when: '.Data.rol'},
        {label: 'Invited by', value: '{{ .Data.invita }}', when: '.Data.invita'},
        {label: 'Expires', value: '{{ .Data.vence }}', when: '.Data.vence'},
      ]},
      button('Accept invitation'),
      {type: 'help', text: 'If you do not have an account yet, you will create one when you accept. You can decline the invitation with no consequences; just ignore this email.'},
    ],
    note: [{type: 'help', text: `Do not know {{ or .Data.invita "who is inviting you" }} or did not expect this? Do not open the link and tell us at ${support}.`}, copyUrl],
    footer: {strong: ANTI, extra: 'The link is personal; do not forward it.', motive: 'You are receiving this email because {{ or .Data.invita "someone" }} typed this address when inviting people to {{ or .Data.espacio "their workspace" }}.'},
  },
];

const noticeHelp = `If you have any question, write to ${security}. Do not include passwords or codes in your message.`;
const notices = [
  ['password_changed', 'Your account password changed', 'If it was not you, write to us today to protect your account.', 'The password of the account **{{ .Email }}** was changed.', ['.Email'], 'revoke'],
  ['email_changed', 'Your account email changed', 'If it was not you, act today: write to us to protect your account.', 'The sign-in email of your Rovaq account was changed. Check that the details are what you expect.', ['.Email'], 'revoke'],
  ['phone_changed', 'Your account phone changed', 'If it was not you, write to us today to protect your account.', 'The verification phone of the account **{{ .Email }}** was changed.', ['.Email'], 'revoke'],
  ['identity_linked', 'A sign-in method was linked', '{{ .Provider }} was added to your account. Check that it was you.', '**{{ .Provider }}** was added as a way to sign in to your account.', ['.Provider', '.Email'], 'review'],
  ['identity_unlinked', 'A sign-in method was unlinked', '{{ .Provider }} was removed from your account. Check that it was you.', '**{{ .Provider }}** was removed as a way to sign in to your account.', ['.Provider', '.Email'], 'review'],
  ['mfa_factor_enrolled', 'A two-step verification was added', 'We will now ask for a second step when you sign in to Rovaq.', '**{{ .FactorType }}** was turned on as a second step when signing in.', ['.FactorType', '.Email'], 'revoke'],
  ['mfa_factor_unenrolled', 'A two-step verification was removed', 'Your account now has less protection. Check that it was you.', '**{{ .FactorType }}** was turned off; your account now has less protection.', ['.FactorType', '.Email'], 'revoke'],
].map(([event, subject, preheader, detail, vars, kind]) => {
  const withUrl = !!IDENTITY.revokeUrl;
  const callout = withUrl
    ? (kind === 'revoke' ? 'Revoke the change now. We will close all open sessions and ask you to verify your identity.' : 'Remove the access from Settings > Security and close open sessions.')
    : `Write to us right away at ${security}. We will review your account and, if needed, close open sessions.`;
  return {
    id: event + '_notification', event, notice: true, subject, vars, preheader,
    eyebrow: 'Security notice', h1: subject,
    blocks: [
      {type: 'p', text: detail},
      {type: 'callout', title: 'If it was not you', body: callout},
      ...(withUrl ? [{type: 'button', label: kind === 'revoke' ? 'Revoke this change' : 'Review my security', href: IDENTITY.revokeUrl}] : []),
      {type: 'help', text: 'If it was you, you do not need to do anything.'},
    ],
    note: [{type: 'help', text: noticeHelp}],
    footer: {strong: ANTI, motive: 'We sent you this notice because a security detail of your account changed. It cannot be turned off.'},
  };
});

export const catalogEn = [...actions, ...notices].map(item => Object.freeze(item));

const layoutArgs = item => ({go: true, idioma: 'en', assetOrigin: IDENTITY.assetOrigin, subject: item.subject, preheader: item.preheader, eyebrow: item.eyebrow, h1: item.h1, blocks: item.blocks, note: item.note, footer: item.footer});
export const renderEn = item => renderLayout(layoutArgs(item)).html;
export const renderTextEn = item => renderLayout(layoutArgs(item)).text;

export function managementPatchEn() {
  const patch = {};
  for (const item of catalogEn) { patch['mailer_subjects_' + item.id] = item.subject; patch['mailer_templates_' + item.id + '_content'] = renderEn(item); if (item.notice) patch['mailer_notifications_' + item.event + '_enabled'] = true; }
  return patch;
}
