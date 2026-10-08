# Control local de CRM acotado — fase 5

Examen externo al candidato. Fixtures SYN; no llama proveedores ni toca producción.

```sh
VEXA_CANDIDATE=/ruta/candidato node --test support/F03-crm-bounded/hosted.test.mjs
VEXA_CANDIDATE=/ruta/candidato VEXA_CRM_BASELINE=/ruta/baseline VEXA_CRM_EVIDENCE=/ruta/recibo-nuevo node --test support/F03-crm-bounded/sql-http.test.mjs
```

Usar Node 22/26 y coordinar una sola corrida de servicios. SQL reutiliza F03-sync: paquetes compilados en temporal, dependencias offline, PostgreSQL/Auth/Storage/PostgREST reales locales, conexiones sin bypass RLS, journal propio y cleanup por identidad. El bootstrap de Storage procede de la imagen real fijada en ese harness, compatible con 0041. La identidad del worker viene de un puerto sintético; membresía y autorización se revalidan en SQL real. No se prueba login HTTP por el hecho de levantar Auth. HTTP usa un servidor Node en loopback y el handler/runtime reales; no ejecuta Next ni cron remoto.

El control puro exige hasta 100 unidades bajo el deadline original de 15 segundos, límites de entrada, secreto, exclusión mutua y liberación del guard incluso si close falla. SQL verifica checkpoints/canonical/raw y reanudación, fallo de segundo COMMIT, revocación durante la segunda consulta al proveedor, 401, Retry-After de 600 segundos, hint no representable con bloqueo y recuperación por owner.configure. El abort de transporte usa su temporizador real; el reloj lógico sólo se adelanta para controlar qué lado del deadline corresponde.

La comparación usa el handler anterior original (maxPages=1) y el handler candidato (maxPages=100), ambos con el runtime candidato y conjuntos equivalentes de un hilo más cuatro mensajes. Se miden tiempos HTTP con performance.now y se conserva cada muestra anterior. Forzar next_attempt_at entre las cinco llamadas anteriores excluye las esperas del cron; no se calcula un ahorro de tiempo de producción. El oráculo es 5 páginas durables en una llamada frente a 1 por llamada, no una razón de latencias. No mide un proveedor real, una red remota, carga concurrente ni un universo mayor de datos.

No acepta fases por sí solo. Exigir salida cero, ocho casos SQL completos, seis casos puros, hashes intactos y cleanup removed=true. Conservar recibos fallidos, no sobrescribirlos.
