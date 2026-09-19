# Evidencia de construcción y límites

## Verificado en este corte

- 55 fichas y catálogo coinciden con su fuente autorada; grafo válido, ocho gates presentes y 47 ausentes. Audit exit0; readiness exit2 por bloqueo real.
- `npm test`: 12 tests de kernel y 12 de preparación/negativos pasan. `npm run test:business`: 12 pasan.
- `python3 -W error::ResourceWarning -m unittest discover -s tests/controller`: **80 tests OK**, 37.216s. Git/worktrees reales, CLI Codex simulado en la suite.
- `npm run test:all-gates`: **exit1**, por scaffold inexistente. No se anuncia verde por correr sólo bootstrap.
- Cinco mutaciones seleccionadas del kernel mueren por aserción, no error de instalación. No es score de mutación del producto entero.
- Verificadores de entrega técnica y negocio: exit0. Conservan siete originales/seis audios/36 salidas ASR, fuentes y modelo de negocio. No certifican semántica ASR, demanda o ingresos.
- Revisión original: H1/H2 P1 y H3 P2, reproducidos y corregidos con diez regresiones. Se conservan [reporte original](REVISION-INDEPENDIENTE.md) y [respuesta con correcciones](CORRECCIONES-REVISION.md). [Revisión correctiva](REVISION-PARCHE.md): H1/H3 resueltos; encontró H2b, permisos que Git no promueve. Se reprodujo en rojo y se corrigió haciendo el recheck sobre una materialización limpia del commit, también en auto-accept. Cuatro regresiones adicionales pasan. **El último parche fue verificado por el principal, no revalidado por otro revisor independiente**; no presentar los informes como una aprobación final sin reservas.

## Recorrido real y copia

Pendientes del cierre: ejecutar prepare/verify/accept sobre F00 sintético desde checkout limpio y verificar copia al Escritorio sin pisar cambios. Se registrarán aquí después de observarse, no por tener scripts.

## No acreditado

SaaS, scaffold, Auth/RLS, DB/Storage, consumidor alojado, conectores reales, pipeline IA, ocho vistas operativas, gold humano, piloto, cloud/deploy, contratos/pagos y causalidad. 47 gates siguen por escribir/revisar en control-plane antes de sus incrementos. Guía de punta a punta no significa loop sin intervención humana.

La comparación cubre forma de trabajo especificada frente a referencias de Likida, no madurez equivalente de dos productos. La copia del Escritorio no contiene Git ni estado runtime: construir/reanudar en `~/vexa`.
