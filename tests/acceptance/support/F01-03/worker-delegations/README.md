# Extensión externa F01-03 para SQL 0007

Autoría de examen; no aprobación, freeze ni aceptación. Base de trabajo
`ff5f9bf8813b8d7956f3b1482d2b220cc4b8e6ca`; estado aceptado 15/60.

`oracles.mjs` clasifica exclusivamente `worker_delegations`. No elimina la
aserción de tablas desconocidas ni las matrices de 0004/0005/0006. Su clave es
`(tenant_id,user_id)`, distinta de las entidades con `id`. Se exige FK física
validada a membership, RLS/FORCE, grants y dos funciones con permisos acotados.
Los probes hacen rollback, fuerzan constraints diferidas y sólo deshabilitan
triggers USER para aislar la FK física; los probes de autorización no lo hacen.

Se comprueban roles, acciones, scopes ausentes/ajenos, owner con membership en
ambos tenants, identidad inmutable, revocación, ausencia de efectos persistidos,
actor original y bot habilitado, job ajeno, reserva por identidad y rotación.
La reserva deliberadamente no requiere un tenant preseleccionado: descubre una
única delegación habilitada del actor real. Los usuarios se crean con signup en
Auth local; no se construyen JWT de usuario. El harness existente configura las
claves locales anon/service de infraestructura; no usa credenciales externas.

Rerun sobre snapshot corregido (rutas absolutas, directorio TMP nuevo):

```sh
OUT=$(mktemp -d)
env -u NODE_TEST_CONTEXT node tests/acceptance/support/F01-03/worker-delegations/run.mjs \
  /ruta/snapshot-baseline006 /ruta/snapshot-candidato007 "$OUT"
```

El runner ejecuta gate completo del baseline006, matriz SQL007 y mutantes007,
con `--test-isolation=none`, puertos 58310–58312, imágenes existentes
`--pull never`, recursos UUID, journal de propiedad, eliminación por ID y
verificación posterior por ID. No instala dependencias ni modifica producto.
Los mutantes deben pasar 0 → aserción concreta → 0; un timeout/setup no acredita
sensibilidad. Los mutantes alteran exclusivamente DB desechable del examen.

Para el gate global completo del snapshot corregido:

```sh
env -u NODE_TEST_CONTEXT VEXA_F01_03_PORT_BASE=58310 \
  VEXA_CANDIDATE=/ruta/snapshot-candidato007 \
  node --test --test-isolation=none tests/acceptance/F01-03.test.mjs
```

El runner SQL007 no sustituye el gate completo sobre candidato corregido,
Storage/UI/workers end-to-end, revisión independiente ni accept.
