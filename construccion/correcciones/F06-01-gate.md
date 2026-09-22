# F06-01 — gate independiente 271 (en elaboración)

Base publicada ca0468c455a6942027e516a3d0c15cb2113ffcee. Sólo controles propios, puertos60520..60525. Sin fuentes del producto modificadas.

## Oráculos comprometidos antes de ejecutar producto

- Ingesta, extracción/evidencia y snapshot reales; embeddings sintéticos identificados. O1=10000, O2=20000; P1 vincula ambas y P2 sólo O1. Global30000, filtro SKU-X10000, filas por problema no aditivas.
- Mapping SKU/source autorizado antes del corte; cambios posteriores no reescriben vista/export histórico. Versiones de problema históricas, no títulos actuales bajo snapshot antiguo.
- Vista Overview y Problems comparten tenant seleccionado autorizado, snapshot base, scope derivado, filtros UTC semiabiertos, moneda/basis y hashes. API/JSON/CSV mantienen la misma identidad y minor units exactos.
- Filtro cambia cursor; cursor ajeno al alcance rechazado. Respuesta real A retenida hasta B no puede restaurar A. No fixtures HTTP de negocio.
- Partial conserva subtotal/coverage y total desconocido; empty no se confunde con fallo; stale/error invalidan resultados/export según contrato.
- Roles lectores autorizados; owner solamente mapping. Tenant B, selector ajeno, CSRF, revocación de membresía y evidencia actual deniegan sin payload privado.
- Revisión de UI principal independiente. Mutante causal debe fallar una aserción semántica, no setup. Reviewer272 posee independientes/domain/SQL.

## Correcciones de controles previos

Las seis sustituciones de navegación de paneles operativos hacia /economics y /problems/manage se comprobaron byte a byte contra baseline. No cambian oráculos. Regresiones runtime pertenecen al principal.

## Estado

Contrato final270 y UI principal ejecutados: 15/15 Node26. Caso adicional de envelope agregado después del verde, pendiente del clean final del principal; no se atribuye al resultado anterior.

## Revisión del oráculo histórico antes de ejecutar

El primer borrador seguía el contrato intermedio del autor: merge posterior→stale/null por cambio de `problem_embedding_members.problem_id`. El principal señaló que un merge administrativo no revoca la evidencia capturada y no puede cambiar importes bajo el mismo binding. Se corrigió el oráculo antes de cualquier ejecución: mismas filas, etiquetas, versiones e importes históricos; sólo una retirada real de autorización/evidencia deniega acceso. No se cuenta el borrador como rojo del producto ni como cobertura de estado stale.

Criterio final acordado: `meta.state=stale` puede avisar de una versión administrativa actual distinta sin cambiar `items`, snapshot base ni hash de la proyección. El gate exige igualdad exacta del payload financiero y el aviso separado. Revocar evidencia sigue siendo denegación403/404.

Primera corrida271: Auth/SQL/API/navegación/export/race verdes; el siguiente `.fill` no encontraba textarea SKU porque el label envolvente incorporaba su valor inicial SKU-X tras remontaje. DOM demuestra campo existente. Selector corregido a prefijo semántico /^SKU, uno por línea/; ningún criterio monetario o permiso se relajó. Log rojo private/f0601-functional-271.log y evidencia X2vFdn conservados.

## Evidencia final271

- Implementación ausente: WORKSPACE_IMPLEMENTATION_MISSING.
- Funcional Auth/PG/browser15/15 Node26, incluyendo global30000/SKU-X10000, P1/P2 no aditivos, exportJSON/CSV, consentimiento/CAS de mapping, nav compartida, cursor, respuestas tardías, empty/partial/stale y evidencia retirada.
- Helper272 usa Auth real y poolmax1: read sigue readonly; materialize no escribe finanzas; identidad actual, scopes expirados y revocación comprobados.
- Mutante causal cursor de272 elimina validación authHash y falla el oráculo semántico antes de restaurarse; no duplicar matriz.
- Omisión de envelope diagnosticada por lectura del server.ts225557: sin rojoHTTP preservado. Overrideaaeefcf0 revisado, focal autor3/3 real. El control final suma un caso real200/400/401/403 con trace/contract/retryable para clean final del principal (16 esperados); no se afirma que15 previos lo cubrieran.
- Dos corridas271, seis recursos cada una, cleanup porID y journal0600; sin PIDs ni puertos60520..60525 pendientes.

Cut2 de control271, autorizado por principal antes de adopción: el caso browser usa limit1 real en Problems, avanza a cursor activo, cambia SKU y exige request/UI sin cursor y ambos problemas del alcance. Evita una aserción vacua desde URL que ya carecía de cursor. No se atribuye esta extensión al15/15 anterior; principalclean ejecuta el control final16 más10 independientes. Cut1 conservado en private.
