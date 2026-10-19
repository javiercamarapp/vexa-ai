# Respaldos y restauracion probada

## 1. Que cubre cada capa
| Capa | Que protege | Retencion / RPO | Estado |
|---|---|---|---|
| Backups diarios gestionados de Supabase | Toda la base (fisico). Restaurar deja el proyecto **inaccesible** durante el proceso; no incluye contrasenas de roles personalizados; **no incluye objetos de Storage** (solo sus metadatos) | Pro 7 dias, Team 14, Enterprise 30 (docs oficiales, verificado 18-oct) | Plan real de `vexa-ai` y si hay backups listados: **no verificado** (no se consulto el panel) |
| PITR (add-on) | Cualquier instante en 7/14/28 dias; RPO peor caso ≈ 2 min; exige compute ≥ Small; reemplaza los diarios | ≈ 100/200/400 USD/mes | **No activado ni recomendado hoy** (ver 07); no verificado si esta activo |
| **Respaldo logico por tenant** (`ops/backup-restore/`) | Datos del tenant + esquema + politicas RLS/grants + manifiesto con conteos y hashes; restaurable en cualquier Postgres 17 | el que Javier quiera conservar (propuesta: semanal + antes de toda migracion/carga masiva) | Probado en local con datos sinteticos |
| Storage (adjuntos 15.6 GB) | Los bytes NO estan en ningun respaldo de base. Son **direccionables por sha256** y los originales viven en el Escritorio/iCloud (inmutables) → recargables | — | Politica propuesta: los originales son la copia; verificar por sha256 tras la carga |
| Secretos, Vault, ajustes de Auth, claves de OpenRouter | No incluidos; viven en el gestor/Vercel/Supabase | — | Fuera de alcance; rotar segun runbook |

## 2. Procedimiento

### 2.1 Respaldar (solo lectura; contra produccion lo corre Javier con `!`)
```sh
# Conexion por variables libpq (nunca pegar la contrasena en chat). Rol con BYPASSRLS/superuser (p. ej. postgres); si no, el script aborta.
export PGHOST=<host directo o pooler> PGPORT=5432 PGUSER=postgres PGDATABASE=postgres   # PGPASSWORD desde el gestor/llavero
node ops/backup-restore/backup.mjs --tenant <uuid-del-tenant> --out ~/respaldos-vexa/<fecha>-<tenant> --allow-remote
```
Propiedades: una sola transaccion `REPEATABLE READ READ ONLY` (instantanea consistente), `default_transaction_read_only=on`, `statement_timeout` 600 s (`--statement-timeout`), no sobrescribe, borra su carpeta si falla, permisos 700/600, y excluye al resto de los tenants (la prueba exige que el id del otro tenant no aparezca en ningun archivo). Cubre las 124 tablas de `public` y `vexa_platform` con alcance por `tenant_id`, por `organizations.id` o por FK; si aparece una tabla sin regla de alcance, **aborta** (nada se omite en silencio). `vexa_platform.administrators` es global y se excluye a proposito.
Contiene PII (correos de miembros, conversaciones): guardarlo cifrado y fuera de iCloud compartido; el script no cifra (no verificado/pendiente).
Carga esperada contra produccion: lecturas completas de las tablas del tenant (≈ 103k conversaciones, 293k mensajes, 470k source_revisions, 282k historial): hacerlo en horas valle; el compute Micro puede tardar minutos; no se midio en produccion **[NV]**.

### 2.2 Restaurar y verificar (siempre en un Postgres local desechable)
```sh
node ops/backup-restore/restore-verify.mjs --backup ~/respaldos-vexa/<carpeta> --report /ruta/reporte.json
```
Levanta su propio Postgres 17 en `/private/tmp/claude-501/` (socket unix, sin red), carga esqueleto Supabase minimo + roles + `schema.sql` + datos, **verifica** y lo borra. Salida `RESTORE_VERIFY_OK` o `RESTORE_VERIFY_FALLO` (exit 1) con la lista de fallos:
1. **Integridad de archivos** (sha256 del manifiesto, esquema y catalogo).
2. **Conteo + hash por tabla** (filas y dos sumas de 60 bits de md5 de la fila: detecta perdida, duplicado o alteracion).
3. **Catalogo identico**: RLS habilitada y **FORCE**, politicas, grants, triggers, constraints, funciones (definicion, `security definer`, `search_path`, ACL) frente al origen.
4. **FKs**: 343 verificadas sin huerfanos (la carga usa `session_replication_role=replica`, por eso se valida aparte).
5. **Sondas de RLS con roles reales**: extrano (`authenticated` ajeno) = 0 filas; miembro ve lo suyo (sonda no vacua); `vexa_backend` con otro tenant = 0; `anon` = 0.

Para restaurar «de verdad» en Supabase (desastre): no hay script automatico (restaurar produccion es destructivo). Proceso: (1) congelar escrituras/consumidores; (2) crear un proyecto de recuperacion **solo con autorizacion de Javier (cuesta ~10/mes)**; (3) aplicar `schema.sql`, cargar los `.copy` con la misma secuencia que usa `restore-verify.mjs`; (4) correr las mismas verificaciones contra ese destino; (5) cambiar variables de entorno. Alternativa preferente: restaurar el backup gestionado/PITR desde el panel (accion de Javier). El procedimiento de proyecto nuevo no se ensayo contra Supabase real.

### 2.3 Cadencia propuesta
Antes de aplicar 0051/0052/0053 y antes de cada carga masiva (marketplaces, Tracker, adjuntos); semanal mientras haya cargas; mensual en regimen. Tras cada respaldo, correr `restore-verify` en la Mac (≈ 20 s por 10 mil filas; tiempo con 35k+ filas reales no medido) y guardar el `reporte.json` junto al respaldo.

## 3. Pruebas ejecutadas (local, sinteticas)
`node ops/backup-restore/test.mjs` (tenant A con 8,000 mensajes, 600 clientes, 300 asientos de ledger, 50 embeddings `vector`, 100 adjuntos, 2 versiones de Tracker; tenant B de senuelo): respaldo OK; B ausente; permisos 700/600; negativos (carpeta existente, host remoto sin `--allow-remote`, tenant inexistente); restauracion y verificacion OK (124 tablas, [omitido: dato de cliente] filas, 70 sondas RLS); **7 pruebas de mutacion** que deben FALLAR y fallan: byte alterado, fila alterada con sha corregido, asiento perdido, politica RLS borrada, FORCE RLS quitado, grant extra a `authenticated`, FK huerfana en origen; y limpieza total de procesos/carpetas temporales.

## 4. Limitaciones / no verificado
- Restauracion probada contra Postgres local con **sustituto de pgvector** (dominio `text`; el formato `[a,b,c]` coincide, pero indices HNSW/IVFFlat y busqueda reales no se probaron) y esqueleto minimo de `auth`/`storage`; extensiones Supabase (pg_cron, pg_net, vault, pg_stat_statements) no se restauran.
- Las contrasenas de roles, Auth (solo se respaldan `id,email,created_at,raw_user_meta_data,deleted_at,banned_until` de los usuarios referenciados), Storage y secretos no se cubren.
- No se ejecuto contra produccion: tiempos, permisos del rol de conexion (`postgres` en Supabase suele tener BYPASSRLS: **no verificado**) y tamano real son desconocidos.
- El hash por tabla depende de que `t::text` sea estable entre versiones mayores de Postgres; origen y destino deben ser 17.x.
