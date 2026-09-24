# Identidad y manifiesto de release

Propuesta F08-01. Inventaría un checkout limpio y confirmado, sin leer .env ni valores de variables:

```sh
node packages/release/manifest.mjs --root /ruta/absoluta/checkout --out /ruta/privada/fuera-del-checkout/release-manifest.json
node --test packages/release/manifest.test.mjs
```

La salida nueva es modo 0600 y queda fuera del checkout. SHA, hashes del lock/configuración y orden de migraciones pertenecen al checkout indicado. Los nombres de variables son un inventario estático para revisión, no un esquema completo ni detección de referencias dinámicas. El generador no modifica Git, infraestructura, datos o permisos.

El resultado queda blocked: asociar destino, responsables, revisiones y cero P0/P1 pendientes, regresiones críticas, restore, autorización remota y smoke. Un JSON editado no reemplaza evidencia independiente. Para compilar, configurar VEXA_BUILD_REVISION con source.commit_sha; después comparar /api/health/version y ejecutar el recorrido remoto. READY o HTTP 200 no bastan.

La prueba de autor compiló Next y comprobó por HTTP que cambiar ambas variables de revisión al arrancar no altera la identidad compilada. Usó SHA sintético rotulado, sin cuentas externas. La identidad y el inventario recibieron revisión independiente local. La aceptación completa de F08 y el despliegue real siguen pendientes.

El inventario rechaza flags Git `assume-unchanged` y `skip-worktree`: pueden ocultar diferencias locales aunque `git status` esté vacío. Use un checkout completo sin esos flags.
