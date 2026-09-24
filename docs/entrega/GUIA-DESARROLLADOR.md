# Desarrollo y mantenimiento de VEXA

El estado de construcción está en [PROGRESO](../../PROGRESO.md); esta guía describe el repositorio integrado. Los originales de clientes, credenciales y evidencias privadas permanecen fuera del árbol publicado. Una propuesta local no está desplegada por existir en una copia de trabajo.

## Mapa del código

| Área | Entrada y responsabilidad |
|---|---|
| Web | `apps/web/src/app`: páginas y rutas HTTP; `lib`: adaptadores de servidor; `components`: interfaz. Las rutas comprueban sesión, organización y permisos vigentes. |
| Plataforma | `packages/platform`: identidad, transacciones autorizadas y errores; `supabase/migrations`: DDL, RLS, RPCs y guardas. No derivar tenant de un body no autorizado. |
| Ingesta | `packages/ingestion`, `packages/jobs/durable`, `packages/connectors`: normalización, persistencia canónica, jobs con lease/fence/checkpoint y sincronización CRM. |
| Histórico e IA | `packages/history`, `packages/intelligence`, `packages/gateway`, `packages/problems`: procesamiento durable, redacción, extracción con citas, reservas de presupuesto y agrupación. |
| Economía y workspace | `packages/economics`, `packages/metrics`, `packages/workspace-service`: registros con procedencia, minor units, cobertura, publicaciones y proyecciones autorizadas. |
| Acción | `packages/recommendations`, `packages/interventions`, `packages/briefs`: planes y medición versionados; un antes/después no demuestra ahorro causal. |
| Equipo | `packages/team` y `/settings/team`: invitaciones con Auth, aceptación explícita, cambios de rol con CAS y revocación por organización. |
| Evaluación | `packages/intelligence/learning`, `evaluation`, `candidate-execution`, `candidates`: feedback de desarrollo, evaluación externa, ejecución controlada y selección firmada con rollback. |
| Recuperación y release | `packages/recovery`, `packages/release`: retención/ledger/restauración local e inventario reproducible de versión. |

Consulte las operaciones de cada paquete antes de cambiar un contrato. Mantenga valores desconocidos como nulos y monedas/ventanas explícitas; no convierta un error de lectura en una colección vacía. Un ID conocido no concede acceso. Los consumidores y exportaciones deben volver a comprobar permisos y borrados.

## Preparar un cambio

1. Lea `AGENTS.md`, el estado vigente y la ficha en `construccion/tareas`. Revise propuestas reutilizables y correcciones del gate antes de construir otra implementación.
2. Use una copia aislada con un escritor por área. Registre base, archivos afectados y pruebas del comportamiento antes de modificar. No cambie tests de aceptación u orquestación desde un candidato.
3. Instale y compile en un temporal con el lock exacto y sin `.env`, secretos, `node_modules` ni `.next` heredados. [ENVIRONMENT](../../apps/web/ENVIRONMENT.md) contiene los comandos y variables. Node mínimo22; los recibos identifican las versiones efectivamente probadas.
4. Reproduzca cada defecto con un caso concreto; aplique el cambio mínimo y repita el control afectado. Conserve los fallos de producto, los errores del controlador y sus salidas por separado.
5. Revisión independiente, integración, comprobaciones afectadas y publicación autorizada antes de avanzar. Una finalización de proceso o build correcto no sustituye un resultado funcional.

## Comprobaciones

`npm test` ejecuta kernel económico y fundamentos; **no ejecuta toda la aplicación**. `npm run test:controller` verifica el controlador y `npm run graph:check` consulta el estado del grafo. En una copia de build: lint, typecheck y build del workspace web. Los controles con Auth/PostgreSQL/Storage/navegador requieren Docker, imágenes y puertos propios, más los comandos del paquete o ficha concreta.

No lance `test:all-gates` indiscriminadamente: respete dependencias, autorizaciones, aislamiento y exámenes detenidos. Tampoco cambie un timeout para ocultar un bloqueo o marque verde un hijo que no terminó. Registre comando, salida, hashes de fuentes y recursos; recoja hijos y contenedores por sus IDs, sin borrar recursos ajenos. Las pruebas sintéticas prueban comportamiento, no precisión humana, cobertura del CRM real ni producción.

## Cambios de esquema, runtime y release

No edite una migración aplicada. Añada una migración compatible revisada y obtenga aprobación legítima antes de SQL remoto. La aplicación utiliza login SQL restringido; no requiere superuser ni BYPASSRLS para operaciones normales. Restaurar datos es un procedimiento separado con cuarentena y ledgers vigentes.

Un consumidor tiene configuración, identidad de servicio, delegación y programación propias; el navegador cerrado no debe detener un job durable. Arrancar la web no configura cron ni autoriza llamadas pagadas. Las reservas inciertas de inferencia no se liberan como costo cero ni se reenvían automáticamente.

Los candidatos de extracción ligan configuración, evaluación y código. Next deriva `VEXA_COMPILED_EXTRACTION_CODE` de fuentes al compilar; no lo suministre como secreto o sustituto del build. Los consumidores Node sin compilar usan `readRuntimeCode()` y lo pasan al resolver/runtime. La clave privada del evaluador pertenece al custodio externo, no a la aplicación. Cambiar código, claves o catálogo exige volver a verificar elegibilidad.

La publicación Git usa únicamente el publisher autorizado con Actions desactivadas; confirme integraciones y SHA remoto. Para desplegar, genere el [manifest](../../packages/release/README.md) desde el checkout limpio y suministre el `source.commit_sha` del manifiesto como `VEXA_BUILD_REVISION` al build. Verifique el SHA servido y el flujo completo en el destino autorizado. Los recibos locales y un deployment READY no equivalen a producción validada.
