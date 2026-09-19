# F01-02 · Propuesta aislada de identidad

Entrega de implementación para revisión; no aceptada por gate ni acreditada como producto enterprise completo. Horizonte general del producto: un mes. No commits, push, despliegues, cambios de configuración Supabase, acceso a credenciales ni DB compartida. Otros paquetes y pruebas externas intactos.

## Identidad de la propuesta

- Baseline Git: `ed7f6cae65fceedb805201a2e9752794ce59d524`.
- Candidate SHA: no existe un commit nuevo, por instrucción. El entregable es el diff de este worktree.
- Revisor/gate externo: pendiente de control-plane; las pruebas propias no lo sustituyen.
- SHA256 test de dominio: `890c1a349ff11dc93a1583a2822e299d203cc6ce5fea049c66881b265373b331`.
- SHA256 test HTTP: `42d66f2192503b2c8316993a2ff185004e767590e3b1ece8d7b86cc38fc94ac4`.
- SHA256 migración: `73f98d0b3b895fb3637d6613ad18dde2a48387714424dd0159d5db871b8f9108`.

## API y firmas

`@vexa/platform/session` exporta:

- `IdentityPort.getUser(): Promise<{id:string}|null>`: exige identidad acreditada por Auth. El adaptador web usa el SDK oficial `auth.getUser()`, nunca concede acceso por decodificar JWT.
- `IdentityPort.memberships(userId): Promise<Membership[]>`: consulta por petición; errores se propagan.
- `resolveSession(port, selected?): Promise<{user,memberships,active}>`: sólo memberships activas del usuario; selección inválida/revocada produce 403 sin cambiar silenciosamente de organización.
- `authorizeSelection(port, tenant): Promise<Membership>`: valida UUID y pertenencia vigente. Cookie/body son preferencia, no autoridad.
- `safeNext(value, origin): string`: normaliza URL, verifica origen y rechaza destinos externos, dobles barras, backslashes y sus codificaciones; fallback `/`.
- `assertOrigin(value, origin): void`: igualdad exacta con origen configurado; ausente/diferente produce 403 `csrf_rejected`.
- `AccessError(status,code)`; roles owner/analyst/operator/viewer, estados active/invited/revoked, permissions_version entero positivo.

Rutas:

| Ruta | Comportamiento |
|---|---|
| GET `/` | Sin configuración: estado público honesto. Con configuración: Auth + membership actual, nombres de organizaciones bajo RLS, select HTML con UUID y submit. |
| GET `/login` | Disponibilidad explícita de Google y mensaje de acceso denegado. |
| POST `/auth/google` | Origin obligatorio; habilitación explícita; inicia PKCE mediante SDK. |
| GET `/auth/callback` | Intercambia code PKCE y acredita usuario. Admite OTP `token_hash` + `type=email` sólo con endpoint Supabase loopback. Nunca usa Host como origen de confianza. |
| POST `/auth/organization` | Origin antes de Auth; consulta DB; rechazo 403 `organization_not_authorized` sin sobrescribir cookie activa; selección válida guarda cookie HttpOnly y redirige 303. |
| POST `/auth/logout` | Origin; `signOut({scope:'global'})`, expira cookies y Clear-Site-Data. Fallo remoto devuelve 503, no éxito falso. |

Middleware protege `/` y aplica no-store a identidad/login/callback; la página revalida también en servidor. El middleware propaga renovaciones de cookies al request y response. No se usan cachés de pertenencia. Cada futura ruta privada necesita su propio guard; esta entrega no implementa las ocho vistas.

Cookies: HttpOnly, SameSite=Lax, Path=/, Secure en HTTPS. La cookie de organización dura 30 días como preferencia; se valida siempre contra DB. No cliente Supabase de navegador ni clave de servicio. Cache-Control privado/no-store, Pragma, Expires, Referrer-Policy; guard de BFCache oculta al salir y recarga al restaurar.

## Dependencias y configuración

Versiones exactas comprobadas contra catálogo npm: `@supabase/ssr 0.12.7`, `@supabase/supabase-js 2.116.0`; `tsx 4.23.13` sólo pruebas. Conservados Next 16.3.5, React 19.3.0 y TypeScript 5.9.3. Workspace `@vexa/platform` agregado explícitamente; lock actualizado en temporal.

Variables públicas permitidas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clave pública anon, nunca service_role), `NEXT_PUBLIC_SITE_URL` (origen exacto, sin ruta/credenciales/query). Ausencia total permite build/estado público; configuración parcial o inválida falla cerrada al usarla. HTTP sólo loopback; otros destinos requieren HTTPS.

`VEXA_GOOGLE_AUTH_ENABLED=true` habilita el botón y el inicio OAuth. No configura Google ni prueba que exista el proveedor: principal debe configurar Google/Supabase y autorizar sus redirects. Para OTP local, el driver externo puede emitir enlace PKCE o enlace `/auth/callback?token_hash=...&type=email`. Esta entrega no solicita ni envía emails.

## Migración y revisión coordinada

`supabase/migrations/0001_identity.sql`: organizations, memberships con PK tenant/user, FK auth.users y organizations, constraints y índice por usuario/status. RLS ENABLE + FORCE; lectura propia de memberships, lectura de organizations sólo con membership activa; ninguna política de escritura. Grants SELECT explícitos para authenticated; sin acceso anon/PUBLIC. Sin SECURITY DEFINER ni políticas recursivas.

No había migraciones en este worktree. Principal debe comprobar posibles colisiones con las demás ramas antes de aplicar `0001`, revisar SQL y aplicarla coordinadamente. No resetear la DB. Crear fixtures A/B mediante administrador de la DB de ensayo; la app no provisiona usuarios, organizaciones ni roles. Probar constraints/RLS como anon/authenticated, revocar membership y repetir petición real.

## Corrección focalizada P1 · 19-sep-2026

Revisión independiente rechazada por `Referrer-Policy: no-referrer`: las navegaciones POST de los formularios podían emitir `Origin: null`, correctamente rechazado por CSRF. Se cambia exclusivamente la política compartida a `same-origin`: referrer permitido dentro del origen, omitido hacia externos. `assertOrigin` permanece intacto; no se aceptan null, origen ausente ni cross-origin.

TDD sobre el camino real de middleware: dos nuevas aserciones de headers para `/login` y `/` fallaron contra `no-referrer` (27 pasan, 2 fallan, exit 1); después del cambio, 29/29 pasan. Nueve regresiones HTTP verifican los tres POST (Google, selección, logout) con Origin `null`, ausente y externo: 403 `csrf_rejected`, sin llamadas Auth/DB y sin cambiar organización. Son transportes sintéticos declarados, no navegador/Auth real.

`apps/web/tests/auth-served.test.mjs` arranca el Next compilado en un puerto efímero propio y verifica headers HTTP realmente servidos: `/` y `/login` sin configuración, y `/login` con configuración pública sintética y formularios Google/logout presentes. No contacta Supabase. La página privada `/` configurada se comprueba en middleware con transporte simulado; su navegación autenticada real sigue pendiente. Ejecutar después del build desde la raíz de la copia.

`packages/platform/tests/test-sql.sh` fija y exporta `LANG=C` y `LC_ALL=C`, captura stdout/stderr de initdb, arranque, SQL y parada; conserva el directorio temporal y el exit original si falla. Sólo elimina su cluster desechable tras éxito. No se modificó SQL, configuración Supabase ni permisos. El intento de esta corrección confirmó locale C y preservó diagnóstico de denegación de memoria compartida antes de la migración.

Según evidencia aportada por el principal, SQL aislado pasó fuera del sandbox con entorno limpio y locale C (fixtures/constraints/RLS, **no Supabase Auth**). El primer fallo externo `postmaster became multithreaded` es diagnóstico del entorno sin locale, no un fallo demostrado de la migración. No se reetiqueta como ejecución propia ni se cierran los pendientes de integración/gate/BFCache.

### Comandos y salidas de esta corrección

Copia propia: `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-auth-p1-dw8xy2cc`.
Todos los comandos npm desde esa raíz, con `env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" LANG=C LC_ALL=C NEXT_TELEMETRY_DISABLED=1` y `--userconfig=./empty.npmrc` (archivo vacío). No dependencias/cachés generadas en el candidato.

| Comando | Exit / evidencia en la copia |
|---|---|
| `npm ci --ignore-scripts --no-audit --no-fund` | 0; `install-cwd.log`. Intento inicial con `--prefix` desde el worktree falló EUSAGE por resolución de workspaces; `install.log` conservado. Ejecutar desde cwd de la copia resolvió el fallo sin editar el lock. |
| `npm run test:auth --workspace @vexa/web` antes del fix | 1; `red.log`, dos fallos esperados por header `no-referrer` frente a `same-origin`. |
| `npm run test:platform` | 0; 20/20, `test:platform.log`. |
| `npm run test:auth --workspace @vexa/web` después del fix | 0; 29/29, `test:auth.log`. |
| `npm run typecheck --workspace @vexa/web` | 0; `typecheck.log`. |
| `npm run lint --workspace @vexa/web` | 0; `lint.log`. |
| `npm run build --workspace @vexa/web` | 0 sin credenciales; `build.log`. Advertencia existente middleware/proxy. |
| `node --test apps/web/tests/auth-served.test.mjs` | 0; 2/2, `served.log`. HTTP real, sin navegador. |
| `env -i PATH="$PATH" HOME="$HOME" TMPDIR=/tmp LANG=C LC_ALL=C sh packages/platform/tests/test-sql.sh` | 1 antes de SQL; `sql-attempt.log`. `shmget: Operation not permitted`; logs conservados en `/tmp/vexa-identity-pg.F3SnIG/init.log` y `stop.log`. |
| `git diff --check` | 0 en candidato. |

SHA baseline permanece `ed7f6cae65fceedb805201a2e9752794ce59d524`; sin commit nuevo ni autoaceptación. Hash SHA256 de regresión HTTP servida: `86cfc0211c13f1b47b291867d1c9735575d81770597b13bdf61871cc194083f7`; ensayo SQL: `0e822291509ceb905047b9c3fa576272d35afb5d795ac72e01dd5ae659c0dc54`. Se conservan abajo los resultados y pendientes de la entrega inicial como historial; esta corrección no acredita Auth/DB/BFCache reales ni el producto enterprise completo.

## Verificaciones y resultados de la entrega inicial

Instalación/build/pruebas finales en copia temporal:
`/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-auth-check-wc2jro9w`.
Entorno limpio para npm: `env -i PATH="$PATH" HOME="$HOME" npm --userconfig=/dev/null ...`.

| Comando | Exit / observado |
|---|---|
| `npm install --ignore-scripts --no-audit --no-fund` | 0; sólo temporal; userconfig vacío. |
| `node --experimental-strip-types --test packages/platform/tests/session.test.ts` sobre stubs TDD | 1; 17 fallos de aserción, 3 controles pasan; antes hubo error de sintaxis Node, corregido antes de contar el rojo. Log temporal `/tmp/vexa-auth-red.log`. |
| `npm run test:platform` | 0; 20/20: redirects, Origin, autorización, revocación, error DB, identidad ausente. |
| `npm run test:auth --workspace @vexa/web` | 0; 18/18 HTTP con SDK oficial y transporte simulado: rechazo por autorización separado de CSRF, persistencia, cookies, callback exitoso/redirects, OTP local, logout, DB caída, cookie corrupta. |
| `npm run typecheck --workspace @vexa/web` | 0. |
| `npm run lint --workspace @vexa/web` | 0. |
| `npm run build --workspace @vexa/web` | 0 sin credenciales. Next advierte deprecación de middleware en favor de proxy; se conserva el archivo solicitado y runtime Node. |
| `npm run start --workspace @vexa/web -- --hostname 127.0.0.1 --port 57640` + GET `/` y `/login` mediante urllib | Arranque correcto; ambas 200, no-store y estado explícito sin configuración. Detenido después mediante Ctrl-C del runner (exit 130 intencional). |
| `sh packages/platform/tests/test-sql.sh` | Bloqueada: initdb/child exit 1, sandbox deniega shmget/memoria compartida antes de ejecutar migración. `/tmp/vexa-auth-sql.log`. No PASS SQL. |
| `git diff --check` | 0. |

Pruebas HTTP inicialmente detectaron cinco callbacks 401: fixture de cookie PKCE no serializado como JSON según SDK. Corregido el fixture, sin retirar controles; luego pasan las ramas exitosas. Los tokens de tests son sintéticos con firma ficticia; la red Auth/PostgREST se simula explícitamente. No acreditan firma real ni login de Supabase.

La prueba SQL crea exclusivamente un cluster PostgreSQL desechable con socket privado, sin TCP, usuario fixture y `auth.uid/auth.users` sintéticos. No consulta configuración ni DB Supabase. El sandbox impidió inicializarlo; se conserva para ejecución posterior fuera de esa limitación.

## Pendientes y límites reales

- Principal debe ejecutar gate externo con Auth/DB local reales: PKCE y OTP válidos, token expirado/corrupto, A/B, rechazo fresco por autorización, cookie persistida, revocación y logout.
- SQL/RLS no ejecutados por la restricción de memoria compartida. No comprobados provisioning, aplicación/rollback coordinados ni compatibilidad con otras migraciones.
- Sin Google real, cloud, correos reales, proveedor configurado, pruebas browser de BFCache/back ni refresh expirado end-to-end. Los headers, expiración y guard están implementados; no equivalen a esa prueba de navegador.
- Logout pide revocación global de refresh sessions y elimina cookies locales. La revocación inmediata de access JWT copiados fuera del navegador depende de Supabase Auth/expiración; no se implementó denylist adicional.
- No pruebas externas/controlador ni autoaceptación en este trabajo. No métricas, dinero, conectores, gateway, notificaciones ni pantallas completas.
