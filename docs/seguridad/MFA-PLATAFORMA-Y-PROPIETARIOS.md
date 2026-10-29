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

## 2. MFA TOTP para propietarios de organización: nota de requisitos (no construido)

Objetivo: que un propietario pueda (y una organización pueda exigir) un segundo factor, porque el propietario gestiona miembros, retención y borrados.

Requisitos propuestos:
- Reutilizar las piezas existentes: `src/lib/platform/mfa.ts` (decisión pura), `mfa-server.ts`, la ruta `/seguridad/data` y `parseMfaInput`. No inventar un flujo nuevo de enrolamiento.
- Política por organización: columna o ajuste `require_owner_mfa` (por defecto falso al inicio, para no bloquear a nadie), con un aviso en la pantalla de equipo antes de encenderla.
- Exigir AAL2 para las acciones del propietario con efecto fuerte: cambios de rol, invitaciones, políticas de retención, borrado y purga, exportación del libro de retención. Lectura normal no exige AAL2.
- Aplicación en la base y en el servidor: en la acción de base (`createDatabase`) comparar el claim `aal` del JWT para esas acciones; no basta la interfaz.
- Recuperación: códigos de recuperación o restablecimiento hecho por otro propietario, con registro en `team_audit`. Un único propietario sin factor no puede quedarse bloqueado: exigir al menos un segundo propietario o un procedimiento de soporte con motivo.
- Pruebas: propietario AAL1 recibe 403 en las acciones fuertes; AAL2 pasa; Auth caído falla cerrado; la política apagada no cambia nada.
- Pendiente de GoTrue (AUTH-04): `/seguridad/data` permite enrolar con sesión AAL1; para propietarios conviene exigir reautenticación reciente antes de enrolar.
