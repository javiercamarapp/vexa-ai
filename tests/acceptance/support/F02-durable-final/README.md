# Examen externo F02-05/06 — pendiente de full sobre snapshot fijo

Base de control ff5f9bf8813b8d7956f3b1482d2b220cc4b8e6ca. Estado aceptado: **15/60**, F02-04 ya aceptada/publicada. Este directorio no acepta producto.

Adopción selectiva del soporte ejecutable gate56, sin logs/journals/evidencia histórica. Fuente de producto autorizada read-only: `.runtime/f02-closing-reviews-1789928750854153000/product56`. No usar el árbol activo de producto. Las dependencias, build, modificaciones de mutantes y SQL ocurren en TMP/recursos Docker propios con UUID y `--pull never`; puertos58160–58165. Auth de usuario proviene de GoTrue local. Anon/service keys de la infraestructura desechable no son JWT de usuario fabricados.

Inventario obligatorio:27 grupos, incluidos los16 anteriormente aprobados, P1 SQL007 conservado y health mutation corregido, más9 grupos nuevos. El launcher exige inventario exacto y único, todos pass, tres recibos0→1→0 con aserción objetivo, y cleanup verificable. Un marcador, setup fallido, timeout, skip o subset no acredita PASS. `NODE_TEST_CONTEXT` y filtro se eliminan al lanzar el full. El filtro sólo existe para diagnóstico directo de `examine`; deja `not_run` y resultado FAIL.

Nuevos grupos: dispatcher multi-tenant en procesos fríos y bootstrap sin heartbeat; refresh real Auth; revocación del actor con dead-letter persistente y replay; dataset idéntico en imports/claves distintos; canario SQL fila103 con rollback del segundo chunk; umbrales queue/heartbeat120/60 versus60/30; machine-auth/body/scope a Next real; bytes CSV, fórmula escapada, descarga Chromium y retry; clicks de historial y conflicto CAS real entre owners.

La inyección SQL usa únicamente la DB desechable; el fault deja pasar filas2–101 y falla103. Refresh adelanta el reloj del proceso que gestiona la caducidad de la caché, pero envía refresh tokens expedidos por Auth real. La descarga antiinyección introduce un campo malicioso sintético en la DB del examen. Ningún fallo de setup se considera mutante muerto.

## Comandos requeridos para cierre

Con snapshot nuevo fijo facilitado por el principal, correr **serialmente** en Node22 y Node26:

```
VEXA_CANDIDATE=/ruta/snapshot-fijo env -u NODE_TEST_CONTEXT NODE22 --test tests/acceptance/F02-05.test.mjs
VEXA_CANDIDATE=/ruta/snapshot-fijo env -u NODE_TEST_CONTEXT NODE22 --test tests/acceptance/F02-06.test.mjs
VEXA_CANDIDATE=/ruta/snapshot-fijo env -u NODE_TEST_CONTEXT NODE26 --test tests/acceptance/F02-05.test.mjs
VEXA_CANDIDATE=/ruta/snapshot-fijo env -u NODE_TEST_CONTEXT NODE26 --test tests/acceptance/F02-06.test.mjs
```

No reutilizar PASS de05 como standalone06. No gastar full sobre el producto viejo para redescubrir P1 conocido. Requiere además matriz global007/revisión independiente; cron/net/Vault/cloud y permisos del proveedor siguen sin acreditarse. Evidencia sensible sólo TMP privado, nunca copiar journals0600 al producto/control.
