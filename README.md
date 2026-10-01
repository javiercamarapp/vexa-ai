# VEXA AI

Software para importar conversaciones e información histórica, conservar su procedencia, identificar problemas y apoyar decisiones con evidencia y cifras verificables.

## Estado actual — 1 de octubre de 2026

**59/60 tareas de construcción técnica, 28 aceptadas formalmente. Producción pendiente.** El objetivo es dejar pendientes únicamente cuentas, APIs y datos del cliente; todavía faltan verificaciones técnicas para poder afirmar ese estado.

| Indicador | Estado comprobado |
|---|---|
| Aplicación desplegada | [vexa-ai.vercel.app](https://vexa-ai.vercel.app), producto `f893851` |
| Recorrido remoto sintético | 8/8 fases y ocho vistas, Auth/PostgreSQL/Storage reales, limpieza verificada por MCP |
| Interfaz | Cierre técnico F06-07: 68/68 revisiones de pantalla y ocho acciones persistidas; conserva sus límites de cobertura |
| Recuperación local | Restauración 5/5, retorno a versión anterior y regreso a la actual comprobados |
| Carga | Última medición 10K revisada: 9.800 aceptadas, 100 rechazos esperados, 100 duplicadas, cero pendientes |
| Capacidad pendiente | 50K falló al plazo; 150K de la composición actual no se ejecutó |
| Instrumentación | `66a25c1` registra tiempos y éxito/error por bloque; pruebas Node 22/26 y revisión independiente aprobadas |
| Cierre global | F07-01 abierto; matriz integral con 114 PASS y dos cancelaciones, sin aprobación global |

El nuevo observador cambia el hash del benchmark: las mediciones anteriores conservan su fuente original y no habilitan escalar con ese observador. Los cambios de controles y documentación posteriores al producto desplegado no representan un nuevo despliegue de la aplicación.

[Estado estructurado](construccion/ESTADO-CONSTRUCCION.json) · [Progreso y evidencias](PROGRESO.md) · [Auditoría de 20 rubros](docs/entrega/AUDITORIA-20-RUBROS-2026-10-01.md) · [Backlog de cierre](docs/entrega/BACKLOG.md)

## Implementación disponible

- Frontend de ocho vistas, acceso, roles, organizaciones, acciones, confirmaciones y preferencias. [Tipos de cuenta y dashboards](docs/entrega/TIPOS-DE-CUENTA-Y-DASHBOARDS.md).
- Importación CSV, persistencia, jobs durables, checkpoints, reanudación y revocación.
- Adaptadores HubSpot/Zendesk, histórico e incremental, webhooks y reconciliación de identidades.
- Redacción de datos personales, extracción, problemas, métricas, recomendaciones y evaluación supervisada.
- Eventos, outbox, correo, push y lectura de notificaciones; entrega externa pendiente de proveedores y dispositivos reales.
- Controles de aislamiento, retención, trazabilidad financiera y recuperación, con evidencia de alcance específico.

Estas implementaciones no acreditan por sí solas conexiones reales, todas las rutas bajo cualquier condición ni aprobación de producción. La cobertura y los pendientes están en la auditoría enlazada.

## Qué falta para entregar

| Tipo | Pendiente | Condición de cierre |
|---|---|---|
| Técnico | Capacidad 50K/150K y serie del observador nuevo | Entorno de prueba verificable, mediciones completas, contabilidad y limpieza, revisión independiente |
| Verificación bloqueada | Seguridad global F07-01 y matriz integral | Resolver legítimamente el rechazo automático de revisión y completar los controles; no equivale a una vulnerabilidad demostrada |
| Configuración operativa | Consumidores programados, identidad delegada, alertas, responsables y recuperación gestionada | Configurar y ensayar la operación real; abrir el frontend no mantiene un worker activo |
| Cuentas y datos | Google, CRM, correo/SMTP/DNS, Web Push, modelos/presupuesto, histórico y finanzas | Conectar por un canal seguro y verificar permisos, cobertura, entrega, revocación y costos |
| Validación humana | Gold/holdout, consentimiento, sponsor, ensayo y recepción | Evidencia real; los fixtures no sustituyen participantes ni aprobación |

La [lista para solicitar accesos](docs/entrega/PENDIENTES-PARA-CONECTAR.md) indica qué hace cada elemento, dónde obtenerlo y cómo se validará. No enviar claves a commits ni documentos públicos. El logo definitivo sigue pendiente.

La información histórica permite evaluar configuraciones con referencias y holdout independientes. No garantiza mejora automática ni autoriza que el sistema cambie su código o promueva configuraciones sin supervisión.

## Construir y retomar

Repositorio canónico: `~/vexa`. Leer [AGENTS.md](AGENTS.md), [PLAN.md](PLAN.md), [AUTOMATICO.md](AUTOMATICO.md) y la [guía de construcción](construccion/README.md). Hay 60 fichas y 59 gates disponibles; presencia no significa aceptación. El grafo conserva las 28 aceptaciones formales.

```sh
cd ~/vexa
python3 scripts/guide.py audit
npm test
npm run test:controller
npm run graph:check
```

Los checks básicos usan Node 22 y Python 3. Las pruebas de runtime necesitan su entorno real y se ejecutan en copias de ensayo, conservando fuentes, recibos y limpieza. Un documento o una Mac despierta no prueban que haya procesos de construcción activos.

## Arquitectura y referencias

React/Next.js y TypeScript en `apps/web`; lógica Node.js en `packages`; PostgreSQL/Supabase en `supabase/migrations`; controlador y publisher en `orchestration`. GitHub conserva commits reales y autoría. Actions permanece desactivado y el proyecto Vercel no tiene despliegue automático por Git según la última comprobación; publicar documentación no requiere compilar la aplicación.

[Alcance completo](construccion/ALCANCE-CONFIRMADO.md) · [Blueprint](docs/blueprint/00-BLUEPRINT-MAESTRO.md) · [60 tareas](construccion/05-TAREAS.md) · [Runbook](docs/entrega/RUNBOOK.md) · [Investigación de negocio](negocio/README.md)

Las fuentes originales y los recibos privados permanecen en `private/`, fuera de la publicación. El historial de avances y límites se conserva en Git y en PROGRESO.
