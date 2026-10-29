# Cerrar el registro público de Supabase Auth

Fecha: 29-oct-2026. Estado el 28-oct (lectura de la configuración pública de Auth de producción): `disable_signup=false`, `mailer_autoconfirm=false`. El registro está abierto, pero exige confirmar el correo, lo que mitiga la toma de una invitación (RLS-AUTH-01). Queda el abuso de cuota de correos y la creación de cuentas sin organización.

## Cómo se crean hoy los usuarios (verificado en el código)

| Camino | Código | Depende del registro público |
|---|---|---|
| Invitación de equipo o de plataforma a un correo nuevo | `apps/web/src/lib/team/server.ts` `sender()`: `admin.auth.admin.inviteUserByEmail` con `VEXA_TEAM_AUTH_ADMIN_KEY` (llave de servidor) | No. Es la API de administración de GoTrue; no la bloquea `disable_signup` |
| Invitación a un correo que ya existe | misma función: si el error es `email_exists`, `signInWithOtp` con `shouldCreateUser:false` | No (no crea usuarios) |
| Enlace de acceso de un usuario existente | `apps/web/src/lib/email-auth/server.ts`: `signInWithOtp` con `shouldCreateUser:false` | No |
| Google | `/auth/google`: `signInWithOAuth`. Un correo nuevo SÍ crearía usuario, y con el registro cerrado se rechaza | Sí, y es lo deseado: solo entran por Google quienes ya fueron invitados |
| `signUp` desde el código | No existe ninguna llamada en `apps/web` ni en `packages` (la prueba `registro-cerrado.test.mjs` lo vigila) | No |

Conclusión: cerrar el registro no rompe invitaciones ni enlaces. El único efecto visible es que nadie puede abrir cuenta por su cuenta con un correo que no fue invitado, que es lo que se busca.

## Pasos (los hace el dueño; este trabajo no cambia configuración externa)

1. Antes: confirmar que existe `VEXA_TEAM_AUTH_ADMIN_KEY` en Vercel (sin ella las invitaciones ya no envían correo).
2. Correr `bash ops/security/cerrar-registro.sh` con `!`. Muestra el estado público, pide el token en un diálogo oculto, pide escribir SI y aplica `disable_signup=true`. `--verificar` solo lee; `--reabrir` revierte.
3. Hacer las pruebas manuales que imprime el script (invitar un correo desechable y entrar con él; pedir enlace con un usuario existente).
4. Alternativa sin script: panel de Supabase, Authentication, Sign In / Providers, desactivar «Allow new users to sign up».
5. No correr `supabase config push` con el `config.toml` anterior: ahora el archivo ya dice `enable_signup=false` y `enable_confirmations=true`, que coinciden con la intención y con la confirmación de correo de producción.

## Qué afirmar en público

Después de aplicarlo y probarlo: «El acceso es por invitación». Antes: no afirmarlo (el registro está abierto con confirmación de correo).
