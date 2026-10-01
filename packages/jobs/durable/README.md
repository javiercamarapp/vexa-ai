# Scheduler HTTP local

`scheduler.mjs` ejecuta POST secuenciales al protocolo HTTP del worker. Es una
herramienta local: iniciarlo no configura un servicio gestionado ni acredita
entrega de pg_cron/pg_net/Vault. Estos requieren programación, identidad,
responsables y autorización operativa por separado.

Ejecutar con Node 22 y configuración mediante un canal seguro:

```sh
node packages/jobs/durable/scheduler.mjs
node packages/jobs/durable/scheduler.mjs --once
```

Variables: `VEXA_WORKER_ENDPOINT`, `VEXA_WORKER_TRIGGER_SECRET` e intervalo
`VEXA_WORKER_INTERVAL_MS` (30.000 ms por defecto; número finito entre 10.000 y
60.000 ms). Se conserva la exigencia HTTPS fuera de localhost/127.0.0.1.

Cada intento vence a los 55 segundos. En modo continuo, tanto un fallo HTTP como
un fallo de transporte dejan el próximo intento para después del intervalo
configurado. No hay reintento inmediato ni POST superpuestos. Un resultado
incierto no demuestra que el servidor no haya procesado la petición: la
recuperación durable corresponde al worker, no a este disparador.

Se registra únicamente `worker_http_status=<código>` o `worker_transport_error`;
no se imprimen secretos, URL ni cuerpos. En `--once`, HTTP no exitoso o fallo de
transporte devuelve código 1; éxito HTTP devuelve 0. La configuración inválida
termina antes del POST. SIGTERM/SIGINT cancelan espera o petición activa y cierran
normalmente; cancelar HTTP local no revierte trabajo ya recibido por el servidor.
El proceso debe supervisarse externamente si se requiere reinicio tras una salida
o reinicio de la máquina. Sus logs no sustituyen alertas operativas.

Regresión CLI local (servidores loopback y procesos propios):

```sh
node support/F08-deploy/scheduler-cli.mjs packages/jobs/durable/scheduler.mjs
```

Estos controles se mantienen fuera de los exámenes de aceptación congelados. No prueban DB, proveedores, servicio
remoto, operación sostenida ni preparación para producción.
