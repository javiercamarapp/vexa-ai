import fs from 'node:fs';
import {brand} from '../../apps/web/src/lib/brand.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// A single layout for Supabase Auth's six actions and seven security notices.
// Only documented Go-template values are used; user_metadata cannot supply markup or links.
export const catalog = [
 {id:'confirmation', title:'Confirma tu correo', intro:'Confirma tu dirección para continuar con tu cuenta de VEXA.', action:'Confirmar correo'},
 {id:'invite', title:'Te invitaron a VEXA', intro:'Abre la invitación para revisar el equipo y tu acceso. Unirte requiere tu confirmación en VEXA.', action:'Revisar invitación'},
 {id:'magic_link', title:'Tu enlace para entrar a VEXA', intro:'Accede de forma segura con este enlace de un solo uso. No necesitas contraseña.', action:'Entrar a VEXA'},
 {id:'recovery', title:'Recupera el acceso a VEXA', intro:'Recibimos una solicitud de recuperación. Abre el enlace para verificar tu identidad y continuar.', action:'Verificar mi identidad'},
 {id:'email_change', title:'Confirma el cambio de correo', intro:'Se solicitó cambiar el correo de tu cuenta. Confirma sólo si tú pediste este cambio.', action:'Confirmar cambio de correo'},
 {id:'reauthentication', title:'Confirma que eres tú', intro:'Usa este código en la pantalla donde solicitaste verificar tu identidad.', code:true},
 ...[
  ['password_changed','La contraseña de tu cuenta cambió'],
  ['email_changed','El correo de tu cuenta cambió'],
  ['phone_changed','El teléfono de tu cuenta cambió'],
  ['identity_linked','Se vinculó un método de acceso'],
  ['identity_unlinked','Se desvinculó un método de acceso'],
  ['mfa_factor_enrolled','Se agregó un método de verificación'],
  ['mfa_factor_unenrolled','Se eliminó un método de verificación'],
 ].map(([event,title])=>({id:event+'_notification',event,title,intro:'Se registró este cambio de seguridad en tu cuenta de VEXA.',notice:true})),
].map(item=>Object.freeze({...item,subject:item.title+' · VEXA'}));
const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function render(item,settings) {
 const asset=brand(settings);
 const logo=asset.logoPath?`<img src="{{ .SiteURL }}${asset.logoPath}" width="${asset.width}" height="${asset.height}" alt="VEXA AI" style="display:block;max-width:100%;height:auto;border:0;">`:'<span style="font-family:Arial,Helvetica,sans-serif;font-size:32px;line-height:40px;letter-spacing:-2px;font-weight:800;color:#111111;">VEXA<span style="color:#166534;">.</span></span>';
 const p='margin:0 0 20px;font-size:16px;line-height:1.6;color:#111111;';
 const reminder=item.notice?'Si no reconoces este cambio, contacta de inmediato al administrador de tu equipo por un canal conocido para revisar y proteger tu acceso.':'Si no solicitaste este correo ni esperabas una invitación, puedes ignorarlo. No compartas este mensaje ni sus enlaces.';
 const action=item.code?`<p style="${p}">Código de verificación</p><p style="margin:0 0 24px;font:700 28px/1.5 monospace;letter-spacing:4px;color:#111111;">{{ .Token }}</p>`:item.action?`<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#166534" style="border-radius:6px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 24px;border:1px solid #166534;border-radius:6px;background:#166534;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;line-height:24px;">${escape(item.action)}</a></td></tr></table><p style="${p}margin-top:20px;">El enlace caduca y sólo se puede usar una vez. Si ya no es válido, vuelve a VEXA y solicita uno nuevo.</p>`:'';
 return `<!doctype html>
<html lang="es" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${escape(item.subject)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
<div lang="es" dir="ltr" style="display:none;max-height:0;overflow:hidden;">${escape(item.title)}. ${item.notice?'Revisa la seguridad de tu cuenta.':'Continúa de forma segura.'}</div>
<table lang="es" dir="ltr" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;"><tr><td style="padding:0 0 24px;text-align:center;">
${logo}
</td></tr><tr><td style="padding:32px 24px;background:#ffffff;border:1px solid #cad4c8;border-radius:12px;">
<h1 style="margin:0 0 20px;font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-0.5px;color:#111111;">${escape(item.title)}</h1>
<p style="${p}">${escape(item.intro)}</p>
${action}
<p style="${p}margin-bottom:0;">${escape(reminder)}</p>
</td></tr><tr><td style="padding:24px 8px;text-align:center;"><p style="margin:0;font-size:14px;line-height:1.6;color:#404040;">VEXA AI · Acceso y seguridad de tu cuenta</p><p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#404040;">Nunca te pediremos contraseñas ni códigos por correo.</p></td></tr></table>
</td></tr></table></body></html>
`;
}
export function managementPatch() {
 const patch={};
 for(const item of catalog){patch['mailer_subjects_'+item.id]=item.subject;patch['mailer_templates_'+item.id+'_content']=render(item);if(item.notice)patch['mailer_notifications_'+item.event+'_enabled']=true;}
 return patch;
}
export function localConfig() {return catalog.map(item=>`[auth.email.${item.notice?'notification.'+item.event:'template.'+item.id}]\n${item.notice?'enabled = true\n':''}subject = ${JSON.stringify(item.subject)}\ncontent_path = "./supabase/templates/auth/${item.id}.html"`).join('\n\n')+'\n';}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
 if(process.argv[2]==='--write'){for(const item of catalog)fs.writeFileSync(path.join(root,'supabase/templates/auth',item.id+'.html'),render(item));}
 else if(process.argv[2]==='--management-patch')process.stdout.write(JSON.stringify(managementPatch(),null,2)+'\n');
 else if(process.argv[2]==='--local-config')process.stdout.write(localConfig());
 else throw new Error('Use --write, --management-patch or --local-config. This tool never sends mail or changes remote configuration.');
}
