# MFA: administradores de plataforma (ya exigida) y propietarios (requisitos)

Fecha: 29-oct-2026.

## 1. Administradores de plataforma: cambio operativo

Antes: la exigencia de AAL2 (segundo factor TOTP) estaba apagada salvo que se definiera `VEXA_PLATFORM_MFA=1`. En producción no estaba definida y los 2 administradores activos tenían 0 factores verificados.

Ahora: la exigencia está encendida por defecto. Se apaga solo con `VEXA_PLATFORM_MFA=0` (también `off` o `false`), como bandera de emergencia.

Qué cambia para los 2 administradores el día del despliegue:
1. Al abrir `/platform` sin AAL2 se les lleva a `/seguridad`. Esa ruta solo exige sesión, así que pueden enrolar un TOTP ahí mismo.
2. Hasta enrolar, `/platform/data/*` y `/api/platform*` responden 403 `platform_mfa_required` y «Ver como» no inicia (también en la base si `vexa_platform.settings.mfa_required=true`).
3. Si Supabase Auth no contesta, no se entra (falla cerrada).
4. Requisito externo: TOTP habilitado en Supabase Auth (Authentication, Multi-Factor).

Recomendación: que cada administrador enrole su TOTP ANTES de que se despliegue este cambio (con la versión anterior, `/seguridad` ya funciona). Si alguien queda fuera, el plan B es poner `VEXA_PLATFORM_MFA=0` en Vercel y volver a desplegar (1 build), enrolar y quitar la variable. Opcional, después de enrolar: `update vexa_platform.settings set mfa_required=true` para que la base también lo exija al iniciar «Ver como» (ver APLICAR.md).

Cambio adicional de código (M-2 de la auditoría 3): la carga de datos de cada página de plataforma vuelve a comprobar AAL2, no solo el layout.

## 2. MFA TOTP para propietarios de organización (construido en F5, apagado por defecto)

Estado: la opción existe y viene APAGADA. Nada cambia para nadie hasta que un propietario la encienda para su organización.

Qué hay:
- Opción por organización `organization_security.require_owner_mfa` (migración `20261206000300`). Se lee y se cambia con `public.org_security`: solo propietarios activos; cambiarla (encender o apagar) exige AAL2 y, para encenderla, al menos dos propietarios activos (si no, la organización podría quedarse sin acceso).
- Con la opción encendida la BASE exige AAL2 en `team_manage` para invitar, cambiar rol, revocar y cancelar invitaciones (`owner_mfa_required`), y la capa de base de la aplicación (`packages/platform/src/db.ts`) lo exige para las acciones `configure`, `approve` y `retain` del propietario. Leer, listar y aceptar invitaciones no exigen AAL2.
- Inscripción TOTP guiada en `/seguridad` (antes solo administradores): los propietarios ven su propio panel y, debajo, la opción de cada organización donde son propietarios, con un aviso previo del número de propietarios que todavía no tienen segundo factor. `/seguridad/data` reutiliza `enroll`, `verify` y `cancel`.
- R2-01 en el servidor: el primer factor exige haber iniciado sesión hace menos de 30 minutos; agregar otro con uno ya verificado exige AAL2.
- La base también exige AAL2 a los administradores de plataforma cuando `vexa_platform.settings.mfa_required` es verdadero (migración `20261206000000`); el estado `status` de `platform_manage` sigue con AAL1 para que se pueda enrolar. NO se enciende: el interruptor sigue en falso.

Cómo se usa (orden): 1) cada propietario inscribe su TOTP en `/seguridad`; 2) un propietario con sesión AAL2 abre `/seguridad` y enciende la opción de su organización; 3) para apagarla se necesita otra vez AAL2.

Pendiente (no construido, decisión o dato): códigos de recuperación y restablecimiento por otro propietario con registro en `team_audit`; exigir AAL2 también a la exportación del libro de retención; aviso por correo a los demás propietarios (hoy queda en `team_audit`); AUTH-04 del lado de GoTrue (la reautenticación reciente se aplica solo en nuestra ruta).
