# Arquitectura de Rovaq AI

Este documento describe cómo está organizado el código. Es técnico y verificable contra el repositorio; no describe cifras de negocio.

## Capas

| Capa | Dónde vive | Responsabilidad |
|---|---|---|
| Interfaz y rutas | `apps/web` | Next.js 16 (App Router) con React 19. Grupos de rutas: espacio de trabajo `(workspace)`, consola de plataforma `/platform`, acceso/autenticación y sitio público `(sitio)`. Las rutas API viven en `apps/web/src/app/api`. |
| Dominio | `packages/*` | Lógica pura o con acceso a Postgres, sin dependencias de la interfaz. Cada paquete trae sus pruebas y, cuando aplica, sus tipos `.d.mts`. |
| Datos | `supabase/migrations` | Esquema, funciones, políticas RLS y vistas. Las migraciones aplicadas no se editan; los cambios son migraciones nuevas. |
| Operación | `ops/`, `docs/operacion` | Respaldo y restauración verificada, diagnósticos SQL, reversa de migraciones, programación y runbooks. |

## Flujo de datos

1. **Fuentes.** Archivos CSV/Excel (cargados por una persona del equipo) y el conector de HubSpot. El conector de Zendesk existe como código con pruebas; no hay acceso de producción conectado. Shopify, Amazon y Walmart entran por archivos de exportación.
2. **Importación.** `packages/ingestion` (lectura y mapeo de archivos), `packages/connectors` (lectura de CRM con checkpoints) y `packages/jobs` (ejecución durable: cola, reintentos, reanudación). Cada registro conserva su fuente, archivo/consulta y fecha de corte (procedencia).
3. **Persistencia.** Postgres en Supabase. Todas las tablas de negocio llevan la organización (`tenant`) y RLS forzado.
4. **Cálculo.** `packages/economics` es la única fuente de cifras de dinero (aritmética exacta con enteros, monedas separadas, desconocido distinto de cero). `packages/metrics`, `workspace-service` e `insights` arman lecturas y agregados sobre ese libro.
5. **Problemas y recomendaciones.** `packages/problems` agrupa conversaciones en problemas con evidencia; `packages/recommendations` y `packages/interventions` implementan el ciclo recomendación, decisión, intervención y medición del resultado.
6. **IA.** `packages/gateway` es la puerta de entrada a los modelos, con catálogo, presupuesto y registro de costo por organización. La IA clasifica y redacta; no produce importes. `packages/agent-datos` y `packages/cfo-copilot` responden preguntas llamando herramientas que leen datos reales y muestran los pasos que siguieron.
7. **Entrega.** `packages/notifications` (correo, avisos y plantillas), `packages/briefs` (informe ejecutivo) y exportes sin datos personales.

## Modelo de acceso

- **Organización (`tenant`).** Unidad de aislamiento. Las políticas RLS se evalúan con la identidad del usuario; las lecturas de servidor usan un rol de base de datos sin `BYPASSRLS`.
- **Roles de organización.** `owner`, `analyst`, `operator`, `viewer`. Las capacidades por rol viven en `packages/platform` y son la fuente de verdad que consumen el menú y las rutas; el menú solo decide qué se ofrece, la autorización la decide siempre el servidor.
- **Plataforma.** Un permiso aparte (`vexa_platform`) para administración de la plataforma: no es una variante de `owner` y no da lectura de datos de negocio de otras organizaciones. La lectura de soporte (ver como) es de solo lectura, con motivo y duración, y queda auditada.
- **Auditoría.** Las mutaciones de plataforma escriben en `vexa_platform.audit` en la misma transacción.

## Procesos programados

`apps/web/vercel.json` define tres tareas periódicas: sincronización de CRM, refresco de metadatos y alertas de seguridad. Los consumidores durables de importación se programan según `docs/operacion/03-CRON-Y-TAREAS-PROGRAMADAS.md`.

## Pruebas

| Qué | Dónde | Cómo |
|---|---|---|
| Núcleo económico | `tests/acceptance/economics.test.mjs`, `packages/economics` | `npm run test:kernel` |
| Sitio público | `apps/web/tests/sitio` | `npm test` |
| Paquetes de dominio y rutas | `packages/**`, `apps/web/src/**`, `apps/web/tests` | `npm run test:paquetes` |
| Interfaz con tsx | `apps/web/tests/*.test.tsx` | `npm run test:web-ui` |
| Aceptación de plataforma (auth, SQL, importación) | `tests/acceptance` | `npm run test:aceptacion` (requiere PostgreSQL 17 local) |
| Guarda de datos de cliente | `tests/seguridad` | `npm run test:datos-cliente` |
| Operación (respaldo, rollback, diagnósticos) | `ops/*/test.mjs` | `node ops/<área>/test.mjs` |

## Límites conocidos

La lista actual de lo que existe y lo que no está en el [README](../README.md#estado-del-producto-honesto). Las notas de diseño por área están junto al código (`packages/*/*.md`) y en `docs/`.
