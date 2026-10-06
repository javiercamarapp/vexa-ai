# Entrada inicial del resumen ejecutivo

Sólo `/overview` sin parámetros de filtros (en API, vacío o únicamente `resource=metrics`) adopta la última publicación del tenant autorizado. La consulta limita tenant, estado publicado y esquema económico, con orden descendente por fecha de publicación e ID. El repositorio de snapshots comprueba permisos, autores, evidencia y digest dentro de la misma transacción antes de adoptar el alcance. Las lecturas posteriores conservan el tenant inicial; un cambio falla cerrado.

Cualquier parámetro explícito de alcance, snapshot, scope hash, cursor, dimensión o formato conserva el comportamiento anterior. Ningún error o publicación inaccesible se convierte en ausencia ni selecciona una anterior. Un periodo que no puede representarse exactamente en el filtro diario existente tampoco se trunca.

La URL resuelta fija fechas, timezone, date_basis, currency, exponent, basis, snapshot_id y scope_hash derivado. Los valores explícitos no se sobrescriben. Actualizar, exportar, paginar y el botón «Última publicación de este alcance» usan esa selección completa; el botón retira únicamente identidad/cursor, conservando el periodo y filtros. El enlace tras publicar un snapshot incluye su ID y todos los filtros base; nunca confunde el hash base con el hash de workspace.

El KPI puede presentar un subtotal válido como cifra principal con el rótulo «Subtotal documentado» sólo cuando el total es desconocido y hay registros conocidos acreditados. Conserva «Total desconocido · Cobertura parcial». Las barras, totales y cálculos no usan ese subtotal como reemplazo. Un 0/0 no se promueve.

Pruebas con fixtures exclusivamente SYN y consultas en memoria:

```sh
node --test packages/workspace-service/tests/initial-publication/run.mjs
VEXA_CANDIDATE="$PWD" node --test support/F06-workspace/independent.test.mjs
npm run lint --workspace @vexa/web
npm run typecheck --workspace @vexa/web
npm run build --workspace @vexa/web
```

La suite focal verifica selección y desempate, aislamiento, autorización e integridad mediante el repositorio real sobre transporte SYN, parámetros explícitos, fallo entre tenants, ausencia, exactitud de URLs y subtotal sin alterar gráficos. No acredita RLS en DB real ni QA del navegador.
