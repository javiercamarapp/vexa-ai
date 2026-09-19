# 00 · Comprobación frente al calibre de construcción de Likida

## Alcance, sin inflar la comparación

Se leyeron los documentos centrales de construcción, un encargo completo de producto, un encargo completo de QA, el plan de adopción y la parte operativa de la máquina de automejora. También se siguió el enlace al plan de cierre del repositorio canónico `~/likida`, porque el propio índice del blueprint advierte que el original fue superado.

**No se auditó toda la compañía Likida ni se revalidó su producción.** Sus cifras de pruebas, migraciones, clientes y bugs son afirmaciones de documentos fechados, no mediciones nuevas de esta sesión. No se leyeron archivos de credenciales ni se copiaron datos de clientes/IP. Es comparación de profundidad de los encargos y disciplina de ejecución; no equivalencia entre dos productos ya construidos.

## Referencias leídas y rangos

Raíz L: `~/Desktop/Documentos Likida/`.

| ID | Archivo / líneas | Uso |
|---|---|---|
| L1 | `00-BLUEPRINT-EJECUCION-CLAUDE-CODE.md`, 1–338, completo | protocolo, cola, SQL/CI, automejora y merge≠deploy |
| L2 | `16-Blueprint-de-Construccion/00-PLAN-DE-CIERRE-VIGENTE.md`, completo | identifica blueprint superado y fuente vigente |
| L3 | `16-Blueprint-de-Construccion/00-PROMPT-SIGUIENTE-SESION.md`, completo | sesión cero-contexto, fuentes, límites, encargos y cierre |
| L4 | `16-Blueprint-de-Construccion/fase-1-primer-cliente.md`, 1–198, completo | archivo concreto, oráculos y responsabilidad humana |
| L5 | `13-Agentes-de-AI/10-Ingenieria-y-Producto/qa-autonomo/encargo-fase-1.md`, completo | simulador, escenarios, presupuestos y expected/actual |
| L6 | `13-Agentes-de-AI/10-Ingenieria-y-Producto/maquina-de-automejora/plan-de-adopcion.md`, completo | secuencia, mutación, propiedades y contraejemplos |
| L7 | misma carpeta, `00-MAQUINA-DE-AUTOMEJORA.md`, 1–240 y 460–756 | marco y Parte2 operativa completa; NO releída la investigación intermedia 241–459 |
| L8 | `00-LO-QUE-FALTA-PARA-PUNTA-A-PUNTA.md`, completo | fallos vivos, contradicciones de fases y lo humano |
| R1 | `~/likida/docs/conocimiento/plan-de-cierre.md`, completo | secuenciación posterior; no asumir estado productivo vigente por el título |

Metadatos/hashes del corte en `REFERENCIAS-LIKIDA.json`. Para citas finas: L1:22–111 protocolo; L1:221–268 automejora; L4:46–118 encargo; L5:51–139 archivos/oráculos; L7:475–756 ciclo/modos/gobernanza/aprendizaje. Los rangos son referencias al archivo leído, no validaciones de sus afirmaciones remotas.

## Brechas encontradas de VEXA antes de esta ampliación

1. Fases F00–F08 tenían sólo 5–7 pasos grandes cada una; el grafo los repetía sin suficiente encargo específico.
2. **54 gates ausentes.** El controlador bloqueaba; no había implementación que construyera el SaaS completo por ejecutar run.
3. F00/F08 requerían aprobación, pero sólo había run/status/accept: faltaba preparar/verificar candidato interactivo.
4. Allowlists no cubrían package/lock/CI/fixtures ni ciertos documentos que las tareas pedían entregar.
5. F00 mezclaba derechos/proyectos reales con preparación local; F00-05 pedía escribir todos los gates antes del scaffold, sin un proceso incremental completo.
6. El estado running se podía considerar reintentable sin resolver si seguía vivo; la recuperación estaba insuficientemente guiada.
7. No existía entrada única con prompt de nueva sesión, arquitectura detallada, comandos por tarea, programa de QA y entrega continua en un solo lugar.

## Matriz de cierre documental y de herramientas

| Dimensión / referencia | Qué exige el calibre | Qué se añade a VEXA | Qué NO demuestra |
|---|---|---|---|
| Fuente vigente L2/R1 | no construir una fase obsoleta | entrada única, grafo v3 e histórico v2 | que todo el código esté construido |
| Sesión nueva L3 | prompt + estado + próximo paso | 01-ARRANQUE, guide next/packet | memoria mágica o loop vivo |
| Encargo L4 | outputs y pasos específicos | 55 fichas generadas de catálogo autorado | aceptación de 55 tareas |
| Dependencias L1/R1 | orden que corresponda a realidad | audit DAG/lecturas/allowlists | acceso cloud |
| Escritura L4/L5 | no tocar lo ajeno | 14 adiciones puntuales de allowlist, controles protegidos | aislamiento contra malware |
| Gate L5 | oráculo observa efecto | 5 gates F00, scaffold/build, kernel compartido; negativos | 47 gates futuros escritos |
| Ruta humana L3 | volver al flujo sin falsear estado | prepare/verify/accept, nota explícita | firma legal/autenticación del aprobador |
| Error L8 | conservar incidente/worktree | history, estados, STOP y recuperación supervisada | recuperación perfecta de SIGKILL |
| Instalación L1 | entorno real reproducible | lock/copia temporal/cache offline y preflight | Docker o proyectos ya activos |
| Datos L1/L5 | constraints y aislamiento reales | esquema y matriz Auth/DB/FK/Storage/RPC | RLS ya implementado |
| Consumer L8 | heartbeat y progreso, no cron decorativo | F02-05/06, JOB01..10, alarma | runtime durable alojado probado |
| Migración CRM | preservar identidad/historia | F03 + alias fixture, comparabilidad | conexión real HubSpot/Zendesk |
| Finanzas L4/L7 | oráculo independiente de LLM | kernel + SYN exacto + mutaciones | ingresos/ahorro causal |
| IA L5/L7 | evaluación fuera del generador | schema/spans/política/holdout/costos | gold humano disponible |
| UX L1/L7 | mirar render y probar efectos | 8 rutas, estados y viewport; fichas F06 | 8 pantallas existentes |
| Búsqueda L6/L7 | seis modos, no sólo unit tests | plan F07 + prueba local de 5 mutaciones | score completo de enterprise |
| Operación L8 | restore, purga y reingesta | 06-OPERACION y F07-06 | restore de producción probado |
| Release L1 | servido SHA y smoke remoto | F08 manifiesto→smoke→rollback→handoff | despliegue autorizado/hecho |
| Negocio L4/R1 | cliente/pago distinto de demo | checkpoints de piloto y acta por capa | entrevistas/pagos reales |
| Veredicto L7/L8 | evidencia y límites visibles | rúbrica/revisor/comandos/recibos | equivalencia total de toda Likida |

## Cambio deliberado v2 → v3

IDs y E00 aceptado se preservan. Se archiva el grafo anterior antes de modificarlo, sin regenerar estado ni abrir una corrida activa. Allowlists se amplían sólo para outputs que la ficha necesita. Tareas interactivas/control/externas quedan requires_approval. F00-02/03 distinguen preparación sintética de piloto/proyectos reales; F00-05 pasa a gates externos justo a tiempo. **Eso reduce el bloqueo artificial de desarrollo, no el umbral de piloto/producción.** F07/F08 retienen la validación real.

No importar de Likida instrucciones de autoaplicar migraciones o deploy automático: pertenecen a otro proyecto/otra autorización. No usar sus números de migración, precio o clientes en VEXA. No copiar sus contradicciones: el documento de reanudación y el estado del repositorio mandan sobre un listado antiguo.

## Cómo juzgar la equivalencia

Hay equivalencia de **forma de trabajo especificada** cuando una ficha define entradas, efectos, oráculo, comandos, límite y recuperación sin depender de esta conversación. No hay equivalencia de madurez productiva hasta que esas pruebas corran sobre la app y cloud reales. La revisión independiente debe juzgar con la rúbrica del capítulo07, no con «se ve largo» o «tiene más páginas».
