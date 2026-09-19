# 02 · Entorno, instalación y accesos sin mezclar cuentas

## Lo observado en esta Mac durante esta ampliación

`node --version` → v26.7.0; Python 3.9.6; Git 2.54.0; Codex CLI 0.154.0; Supabase CLI 2.115.0; Vercel CLI 59.1.4; Docker CLI 29.7.2. `codex login status` confirmó ChatGPT. **CLI instalado no prueba Docker daemon activo, proyectos cloud, permisos ni presupuesto.** No se actualizaron estas herramientas como efecto secundario de escribir la guía.

El mínimo del kernel/controlador es Node>=22 y Python3. Para el SaaS fijar versión de Node compatible con Next y Vercel en F01-01; no inferir compatibilidad por la versión instalada en esta Mac. Las dependencias del informe son separadas: `requirements-negocio.txt`.

## Preparación local — operador, antes del worker offline

1. Reservar repo y directorio VEXA; no tomar `.env` de Likida/Atiende ni sus project refs.
2. Confirmar `git status`, `codex login status`, Node/Python y espacio libre.
3. Comprobar Docker: `docker info`. Si no funciona, iniciar Docker Desktop con autorización o declarar DB integration blocked. No confundir `docker --version` con daemon sano.
4. Obtener versiones desde registro público en sesión interactiva, no en worker:
   ```bash
   npm view next version
   npm view react version
   npm view typescript version
   npm view create-next-app version
   ```
   Guardar fecha/versiones/resolución en lock. Es consulta futura para F01-01; no se declara ejecutada en esta preparación.
5. Ejecutar `create-next-app` con versión explícita inspeccionando `--help` de ESA versión: App Router, TypeScript, `src/`, npm, directorio `apps/web`. Preservar `package.json` raíz y scripts existentes, añadir npm workspaces. No usar Next como API gateway de OpenRouter sin autorización/tenancy.
6. Instalar con `npm ci --ignore-scripts` en **copia temporal revisada** para llenar cache. Inspeccionar cualquier script de instalación necesario antes de permitirlo. Nunca ejecutar instaladores sobre otro repo para «ahorrar dependencias».
7. El gate F01-01 copia inputs a directorio temporal, hace `npm ci --offline --ignore-scripts`, lint/typecheck/build y borra SOLO ese temporal propio. No crea `.next`/`node_modules` dentro del candidato: el controlador interactivo rechaza archivos ignorados/mutación durante pruebas. Cache incompleta es bloqueo de entorno, no fallo de negocio ni mutante muerto.
8. Preparar Supabase local con `supabase init` y `supabase start` en el proyecto aislado después de revisar la configuración. Aplicar migraciones exclusivamente contra esa instancia. `supabase db reset --local` es destructivo para la DB local: sólo namespace de pruebas desechable confirmado, nunca producción.

No hay que gastar OpenRouter para probar Auth/SQL/imports/tenancy. CRM y LLM comienzan como stubs deterministas que se rotulan; **DB/Auth/Storage de ensayo sí deben ser reales** cuando el criterio los requiere.

## Separación de variables

| Categoría | Ejemplos de nombres | Dónde se guarda | Nunca |
|---|---|---|---|
| Públicas del cliente | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY | config pública de entorno autorizado | service_role o OpenRouter en NEXT_PUBLIC |
| Servidor | SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY, CRM_CLIENT_SECRET | secret store del entorno | commit, browser, captura, prompt de worker |
| Desarrollo/fixture | URL/credenciales de instancia local efímera | temporal del verificador fuera del candidato | reutilizar en otro tenant/producción |
| Constructor | OAuth de Codex/ChatGPT | almacén propio de Codex | conversión a API-key fallback |

El controlador limpia variables del worker y su gate; no basta hacer `export` de una llave esperando que se herede. Para integración, el **verificador externo** aprovisiona contexto efímero local y pasa sólo esos valores al proceso de ensayo. El candidato no decide host/proyecto ni obtiene llaves reales. No agregar `SUPABASE_SERVICE_ROLE_KEY` a `clean_environment` para quitar un bloqueo.

## Derechos/cuentas: quién desbloquea qué

| Falta | Quién responde | Evidencia mínima | Qué se puede hacer mientras |
|---|---|---|---|
| Roles sponsor/CRM/privacidad/finanzas | interlocutor autorizado del piloto | nombre, rol, aceptación, referencia | fichas/fixtures locales |
| Datos Senix/YAT | titular/controlador y privacidad | finalidad, campos, subprocesadores, retención, permiso | sólo sintético |
| HubSpot | admin cuenta propia del piloto | app/scopes/endpoint de mensajes y prueba read-only autorizada | contrato con stub |
| Zendesk | admin de instancia | subdominio/scopes/comments/cursor confirmados | contrato con stub |
| Vercel/Supabase/GitHub VEXA | Javier/owner designado | project refs, entornos, presupuesto, permiso específico | scaffold y CI local |
| OpenRouter real | owner presupuesto/privacidad | política endpoint/modelo/retención/región y tope | stub sin costo proveedor |
| Logo/caso/pitch identificable | titular de marca/datos | autorización de publicación, no sólo NDA | marca propia + demo |

Una aprobación puede ser limitada a un entorno/fixture, no a todos los pasos futuros. Estados de F00 significan preparación local; no rebautizarlos como integración o piloto terminado.

## Cuándo el entorno merece más aislamiento

Un Git worktree comparte host y `.git`. Las firmas detectan cambios, no impiden leer secretos de HOME. Con código/paquetes no confiables, usar VM/contenedor desechable sin llaves, sin mounts de otros repos y red denegada; no montar el HOME real por comodidad. Esta entrega prueba un controlador para agentes cooperativos con errores, no resistencia a malware.
