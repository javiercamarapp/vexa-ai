# Propuesta F01-04 — shell autenticado, no backend F06

## Reutilización y límite de escritura

Se reutilizan navegación, DataState, filtros, contrato/validación de alcance y presentación del laboratorio revisado `56f051b`, sin incorporar módulos de negocio fuera del mapa F01 (`apps/web`, `supabase`, `packages/platform`). Se conservan Auth y controles de organización aceptados. El inicio autenticado añade un enlace real «Abrir workspace».

Las seis entradas de navegación y dos rutas de detalle forman la base de las ocho vistas. Los estados discriminados `loading/empty/error/partial/stale/ready`, foco, teclado y filtros URL pertenecen a esta tarea. No se crean KPIs, registros de muestra ni endpoints que finjan operaciones.

`lib/workspace/server.ts` conserva la sesión real y el puerto de lectura tipado, pero **no registra todavía el adaptador F06**: devuelve `workspace_unavailable` de manera explícita. La UI explica esta falta de integración; configurar sólo la DB no se presenta como suficiente. Por ello esta base no puede mostrar datos ni realizar acciones de negocio. La rama de integración separada sí tiene el adaptador real y el flujo CSV→recomendación→intervención→brief→inbox, sin que ello acepte automáticamente F02–F06.

## Verificación

- Principal: `VEXA_CANDIDATE=<propuesta> node --test tests/acceptance/F01-01.test.mjs`, exit0; build/arranque reales en copia temporal. No instalación de dependencias en candidato.
- Gate F01-04 todavía en revisión externa por un negativo de escalación de rol. Su aprobación/congelación y el ensayo sobre esta propuesta siguen pendientes.
- Primera revisión independiente rechazó dos P2: refresh sin Set-Cookie en rutas nuevas y reset de Customer Detail hacia /customers inexistente. Rechazo preservado; corrección en otro worktree para no alterar los ensayos sobre el anterior.
- Ambos se reprodujeron rojos con Auth propio (WORKSPACE_REFRESH_COOKIE_REQUIRED y DETAIL_RESET_PRESERVES_ID). Middleware ahora renueva antes del render en todas las rutas de esta base; reset conserva el ID escapado. `python3 apps/web/tests/workspace/recovery/run.py` pasó lint/build/types y HTTP real, exit0. Un primer ensayo del nuevo runner omitió copiar migraciones (ENOENT), se conservó y corrigió; no se contó como rojo de producto.
- Revisión independiente del correctivo: pendiente. El ensayo anterior de gates aceptados mostró193PASS/0fail, pero no se capturó el exit del launcher y corresponde al árbol previo al correctivo: NO es aceptación de este árbol.
- Ninguna aceptación, publicación o producción se afirma aquí. No Google remoto, proveedores reales, worker alojado, envíos externos ni servicio F06 aceptado.
