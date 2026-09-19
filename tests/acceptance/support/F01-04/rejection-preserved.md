# Rechazo independiente conservado — entrada de corrección 2026-09-19

No se revoca el rechazo ni se autoaprueba el examen. Hallazgos reproducidos por la revisión recibida:

- P1: `routes.mjs` copiaba fixture 0600 a Docker, ilegible para `node` (EACCES); circuito Auth no ejecutado.
- P1: positivos exigían HTTP 200 y links problem/customer producidos por backend F06, fuera de la allowlist F01-04. Debe verificar seis destinos y dos detalles directos, con shell autorizado y error honesto de dependencia posterior permitido (200/503).
- P2: `<a href="#" tabIndex={-1}>` sobrevivía; faltaba nueva petición/render y accesibilidad del reintento.
- P2: FAKE/duplicadas aceptaban alerta genérica 503 sin validar; faltaba error específico e independencia de DB, y mutante de omisión de validación.

README-rejected-original.md, probe-result.txt, absence-result.txt y evidence/ conservan el estado previo. Las nuevas corridas usan nombres correction-*; no sustituyen recibos adversos. No existía construccion/correcciones/F01-04-gate.md al iniciar.

## Nuevo rechazo independiente P1 — fixture sólo owner

Revisor: TMP `f0104-independent-6hf1jdfc`, leído sin modificar. Mutación `packages/platform/src/session.ts`: `return {user,memberships,active};` → `return {user,memberships,active:{...active,role:'owner' as const}};`. El examen anterior sobrevivió completo **3/3**, 54 validaciones Auth, exit0. Evidencia original copiada sin cambios en `role-rejection-review.txt`, `role-rejection-role-mutant.txt` y `role-rejection-role-mutant.patch.txt`. El rechazo permanece; el correctivo requiere nueva revisión independiente.
