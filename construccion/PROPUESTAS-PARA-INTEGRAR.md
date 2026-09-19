# Banco de código revisado — no reinventar, no autoaceptar

2026-09-19. Propuestas locales en ramas separadas, no fusionadas a baseline ni publicadas como tareas aceptadas. El principal reprodujo las pruebas; dos revisiones por módulo resolvieron hallazgos reales. El código sigue requiriendo integración, persistencia y examen externo por ID del grafo.

| Scope | Commit local inmutable | Pruebas finales | Uso previsto |
|---|---|---:|---|
| packages/ingestion, packages/connectors | `983e007e98f8516ad0380ba4f51ee58b2086fa54` |21| F02-01/03/04 y F03; CSV/envelopes/revisiones/aliases, adaptadores GET parciales |
| packages/gateway, packages/intelligence | `733c47edb441f03ff50a22b8bd965ce7e407497a` |34| F04-01..04; presupuesto por puerto, extracción/citas; repositorio durable pendiente |
| packages/notifications | `1a0df4e4e574eb8c799fa736e8c2412fe4f112e1` |27| Ampliación F06; política/templates/transportes/outbox por puerto; SQL/SDK/SW/emisores pendientes |

Git de **sólo lectura** está permitido: `git show <sha>:packages/.../IMPLEMENTATION.md`, `git diff`, `git status`. Prohibido al constructor cambiar HEAD/historial/config del candidato. Esos commits sólo existen en este repositorio local; si faltan, detener adopción y pedir recuperar el banco, no fingir que se leyó.

Leer primero el IMPLEMENTATION.md de cada scope y luego los archivos concretos; no copiar todo el árbol ni sus docs/control-plane antiguos. Adoptar sólo rutas permitidas en el candidato actual, después de que el controlador congele el gate externo. Adaptar integración al contrato vigente, ejecutar regresiones y someter el diff a revisión. Las pruebas del constructor no se convierten por copia en exámenes de aceptación.

## Límites que no deben desaparecer al integrar
- CSV no equivale a Excel. HubSpot sólo threads legacy v3, pendiente spike de versión/mensajes/scopes; Zendesk sólo export tickets, comentarios pendientes. Ambos son HTTP parametrizados con transporte simulado en tests, no cuentas reales conectadas.
- Mapas en memoria de dedup/budget/outbox no son repositorios durables. Deben conectarse a transacciones, constraints, leases/fences y RLS; no mantener estado productivo sólo en memoria.
- Clasificación probada por esquema/citas no acredita precisión, causa o calibración. PII se redacta antes; modelos/precios/políticas reales se configuran y verifican, no copiar candidatos sintéticos.
- Notificaciones sólo usuarios VEXA. Proveedor accepted no significa delivered; incierto no se libera/reenvía por adivinación. SDK Push, webhooks, service worker, SQL, emisores y canales reales aún pendientes.
- Conflictos declarados (p.ej. rol unknown y versión HubSpot) se resuelven explícitamente con el contrato; no ocultarlos con cast ni degradar pruebas.

Auth no se toma de estas ramas: **F01-02 ya está integrado y aceptado** en baseline, con migración de identidad y prueba real local. Conservar y extender esa implementación.
