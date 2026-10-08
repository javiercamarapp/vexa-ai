# VEXA AI

## Estado vigente — 7 de octubre de 2026

Consultar [ESTADO-VIGENTE.md](docs/ESTADO-VIGENTE.md): **Fases 1 y 2 completadas en su alcance local.** F07-01 pasó los 17 componentes sin fallos ni cancelaciones sobre candidato `54be5cf`, control `d6d87d1`; 78 recursos propios ausentes. Cuatro defectos de producto corregidos con regresiones. Auditoría npm de producción sin alertas; cinco alertas altas de desarrollo por braces siguen abiertas. Sin push, despliegue ni cambios externos; producción y aceptación formal no acreditadas. Se mantienen los contadores 59/60 técnicos y 28/60 formales sin alteración manual. Siguiente: fase 3, health/version y nueva serie de capacidad 10K → 50K → 150K.

Los cortes fechados que siguen son históricos y no sustituyen el estado vigente.

Software para importar conversaciones e información histórica, conservar su procedencia, identificar problemas y apoyar decisiones con evidencia y cifras verificables.

## Estado actual — 3 de octubre de 2026 (UTC)

El acceso y el panel ajustan tipografía, composición y controles a las referencias de Likida y Atiende. La primera visita sin sesión ya no muestra un rechazo de permisos. La comparación sintética de persistencia completó cuatro ventanas y ocho controles; la propuesta experimental redujo la media aproximadamente un 7 %, sin acreditar 50K/150K ni adoptar la optimización. [Diseño, pruebas y límites](docs/entrega/DISENO-Y-CAPACIDAD-2026-10-03.md). Se mantienen **59/60 implementadas y 28/60 aceptadas**, con producción pendiente.

La ingesta sintética de 10.000 filas pasó en GitHub Linux ARM (4 CPU, aproximadamente 16 GB): 9.800 aceptadas, 100 rechazos esperados, 100 duplicadas y cero pendientes. El trabajo tardó 220,15 segundos y retiró sus cinco recursos propios. Revisión independiente y restauración de Actions a desactivado comprobadas en los recibos. Es una medición de un consumidor, sin IA ni validación de capacidad comercial; 50K/150K de esta composición siguen pendientes. [Resultado, fuente y límites](docs/entrega/CAPACIDAD-CI-10K-2026-10-03.md). Se mantienen **59/60 implementadas y 28/60 aceptadas**.

El acceso y el espacio de trabajo adoptan un diseño compacto: login con imagen fija, selector de organización en el pie gris, navegación por categorías excluyentes y temas claro/oscuro. El resumen presenta importes y cobertura del mismo corte; no inventa series históricas ni suma exposición y reembolsos. La consulta mantiene el alcance y las referencias del servicio existente. Revisión independiente y pruebas de composición registradas; no acreditan nuevas aceptaciones formales ni producción completa.

El selector de importación permite elegir explícitamente el perfil histórico para CSV y exige volver a validar al cambiar de modo. La persistencia local pasó siete controles con PostgreSQL/Auth/RLS reales; el componente pasó cinco casos React/DOM y 16 regresiones sintéticas. Se conservan textos de 100.000 caracteres y fechas originales; selección, reintentos y permisos verificados en ese alcance. No acredita carga de cliente, Storage remoto, capacidad ni nuevas aceptaciones formales.

El perfil optativo `history-message-v1` conserva textos largos y la precisión original de fechas históricas, sin cambiar los límites por defecto ni fabricar identidades. Revisión independiente474 aprobada; integración:58 comprobaciones Node22,15 Python y declaraciones TypeScript verificadas. El corpus completo pasó en Node26; la corrida completa Node22 quedó inconclusa por el límite del ejecutor y no se cuenta como aprobada. [Contrato y límites](packages/ingestion/HISTORY-PROFILE.md). La comprobación focal local de persistencia y selección UI se documenta arriba; operación de cliente pendiente. No se importaron datos ni se ejecutó IA.

La herramienta de preparación histórica ya conserva originales byte a byte y comprueba su correspondencia completa con el registro de procedencia y los lotes candidatos. La revisión independiente cerró tres fallos: hash de entrada incorrecto ante cambio de archivo, valores libres de fuente en consola y proyecciones no cotejadas con el original. Pruebas: 12/12 Python y 32/32 Node22/26. [Uso y límites](scripts/history/README.md). No realiza importaciones ni llamadas a modelos.

Las correcciones de scopes y eventos administrativos de HubSpot están desplegadas en `5d86243`: versión servida, diez fuentes modificadas y comprobaciones HTTP verificadas. La recuperación completó un archivo lógico de la base de origen y retirada de su credencial temporal; no acredita aún restauración ni copia de bytes de Storage. Capacidad, recuperación gestionada completa, revisión global y aceptaciones externas siguen pendientes; se mantienen **59/60 implementadas y 28/60 aceptadas**.

El destino temporal de recuperación ya fue autorizado y creado. La preparación administrativa corrigió la espera de RPC y el sexto ensayo comprobó los positivos Auth/RPC/Storage. Falló la denegación de una URL firmada tras cerrar las conexiones: devolvió los bytes sintéticos. Se corrigió y verificó la limpieza posterior; el destino quedó vacío y cerrado. El aislamiento de archivos durante la restauración sigue pendiente. Capacidad conserva cero ventanas nuevas: el quinto intento se detuvo antes de crear infraestructura por presión de memoria. Una comprobación posterior volvió a fallar por CPU insuficiente mientras otros proyectos ejecutaban pruebas. [Evidencia y pendientes](docs/entrega/RECUPERACION-GESTIONADA-PREPARACION-2026-10-01.md). Se mantienen **59/60 fichas implementadas y 28 aceptadas**; restauración y producción no aprobadas.

El ensayo remoto de continuidad de importaciones completó 503 filas sintéticas: pausa de 124 segundos desde el checkpoint 100, reanudación hasta 501+2, 16 respuestas HTTP 200 y limpieza comprobada. El evaluador se corrigió sin alterar los 69 recibos ni repetir el ensayo; 17/17 pruebas pasan en Node 22/26. No acredita operación permanente ni cambia 59/60 técnicas y 28 aceptadas. [Evidencia y límites](docs/entrega/CONTINUIDAD-IMPORTACIONES-2026-10-01.md).

El preflight de carga vuelve a aceptar el inventario publicado: faltaba registrar una prueba nueva del histórico y el runner se detenía antes de arrancar. Se añadió `--preflight` para comprobar fuentes sin levantar infraestructura; 10/10 pruebas pasan en Node 22 y 26 y se verifican 2.158 archivos. Esto no acredita capacidad 50K/150K. [Comandos y alcance](packages/jobs/load/README.md).

La exportación del histórico para evaluación conserva ahora la secuencia del análisis original: antes podía reordenar los mensajes por UUID. La regresión pasa 4/4 en Node 22 y 26 con datos sintéticos, lector y CLI reales; no valida calidad del modelo ni conexiones externas. [Contrato y prueba reproducible](packages/intelligence/learning/README.md). Se mantienen 59/60 técnicas y 28 aceptadas.

El ensayo gestionado de imports pasó: dos invocaciones cron→pg_net→Vercel con HTTP 200, dos filas sintéticas aceptadas y cero pendientes; retirada de programación y delegación comprobada por MCP. Acredita ese recorrido acotado, no operación permanente. [Evidencia y límites](docs/entrega/OPERACION-GESTIONADA-2026-10-01.md).

Las extensiones `pg_cron` y `pg_net` ya están instaladas en Supabase VEXA mediante una migración explícita revisada. Siete comprobaciones posteriores de Auth/Data API pasaron; las dos observaciones conservaron cero tareas programadas, ejecuciones y solicitudes HTTP. La instalación por sí sola no acredita consumidores activos; el ensayo acotado documentado arriba completa la primera comprobación gestionada. La operación permanente sigue pendiente.

La plantilla faltante de notificaciones quedó publicada en `e80b122`, junto con su regresión SQL local 8/8 y guía de los seis consumidores. La propuesta de persistencia 442 pasó 23 pruebas canónicas y 16 casos focales; sigue experimental. Sus calentamientos comprobaron 2194→1900 consultas por bloque, pero la comparación de tiempos se difirió por host no preparado: cero ventanas medidas. No hay nueva validación 50K/150K ni cambio del contador.

**59/60 tareas de construcción técnica, 28 aceptadas formalmente. Producción pendiente.** El objetivo es dejar pendientes únicamente cuentas, APIs y datos del cliente; todavía faltan verificaciones técnicas para poder afirmar ese estado.

| Indicador | Estado comprobado |
|---|---|
| Aplicación desplegada | [vexa-ai.vercel.app](https://vexa-ai.vercel.app) · [SHA servido](https://vexa-ai.vercel.app/api/health/version) |
| Último recorrido remoto sintético integral | Versión `f893851`: 8/8 fases y ocho vistas, Auth/PostgreSQL/Storage reales, limpieza verificada por MCP |
| Interfaz | F06-07: 68/68 revisiones y ocho acciones; Equipo añade 16 escenarios locales por rol y revisión independiente. Cada evidencia conserva su alcance |
| Recuperación local | Restauración 5/5, retorno a versión anterior y regreso a la actual comprobados |
| Carga | Última medición 10K revisada: 9.800 aceptadas, 100 rechazos esperados, 100 duplicadas, cero pendientes |
| Capacidad pendiente | 50K falló al plazo; 150K de la composición actual no se ejecutó |
| Instrumentación | `66a25c1` registra tiempos y éxito/error por bloque; pruebas Node 22/26 y revisión independiente aprobadas |
| Cierre global | F07-01 abierto; matriz integral con 114 PASS y dos cancelaciones, sin aprobación global |

El nuevo observador cambia el hash del benchmark: las mediciones anteriores conservan su fuente original y no habilitan escalar con ese observador. La verificación remota anterior, del release `dbb834c`, incluye la corrección de Equipo y las fuentes públicas actualizadas. READY, SHA servido y ocho fuentes modificadas comprobados; no se repitió el smoke remoto integral. La programación permanente sigue pendiente.

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
