# Caos del núcleo durable publicado

Ensayo portable local SYN, semilla42, PostgreSQL/Auth/Storage/Next y worker reales. No es aceptación formal ni auditoría de seguridad. Base d723cc2b3e2dd985eb04dccfa70187eeac07bddf, migraciones publicadas hasta0038; excluye F06-09 y propuestas29–32. No requiere ni incorpora la composición privada de notificaciones.

```sh
node packages/jobs/chaos/run.mjs --synthetic-local --candidate /ruta/al/checkout --evidence /private/tmp/chaos-evidencia-nueva --repetitions 3
```

Requiere Node22/26, Docker e imágenes ya presentes (`--pull never`), caché npm y puertos61620–61625 libres. Instala sin scripts y compila/lint en temporal, sin leer .env ni usar SQL remoto. Evidencia fuera del checkout; journal0600, recursos UUID e inspección de propiedad para caída DB y cleanup.

Reutiliza selectivamente siete módulos de autor310 y el oráculo318 del prefijo100/350: SIGKILL después de commit y antes de ACK, reinicio desde checkpoint y250filas restantes, sin cambiar prefijo ni duplicar identidades. Los resultados30/30 de310 no se atribuyen al esquema actual. El harness aceptado F02 se transforma sólo en temporal (puertos, imports, dependencias publicadas, clave SYN de retención y checks estrictos de procesos); no modifica producto ni controles protegidos.

Once escenarios por vuelta: crash postcommit/preACK, lease vencido y fencing, Storage429/backoff,401/dead-letter/replay manual, revocación durante trabajo, deadline, cancelación explícita, caída DB, cuota concurrente, timeout LLM con costo uncertain y borrado/replay. Cada escenario compara snapshot financiero y componentes inmutables, además de filas/cursor/contabilidad/errores y backlog. Los controles de corrupción de resultado detectan cola perdida, cursor antiguo y referencia duplicada; no son mutantes del producto.

La retención usa la API pública del owner: política, preview sin efectos, confirmación firmada, cancelación del job activo, replay y purga Storage autenticada; vuelve a cargar iguales bytes y exige SOURCE_TOMBSTONED sin resucitar contenido. Registra eliminación física del RAW completo y conserva finanzas. No demuestra eliminación en CRM externo ni restore.

Gateway y presupuesto usan repositorio PostgreSQL real con transporte SYN en proceso sin llamadas a proveedores. Reloj gateway controlado; PostgreSQL real con vencimientos explícitos fixture. La recuperación DB incluye reinicio operacional explícito del proceso; no acredita autorrecuperación ni SLA. Las latencias comparten host con otro ensayo y no son benchmark productivo.

Salida: chaos-report.json generado por aserciones, hashes, logs y cleanup. Fallo o señal produce exit no cero. Revisión independiente del principal y aceptación formal pendientes; ninguna aprobación del ámbito excluido.

La carpeta de evidencia debe ser nueva, con padre real existente, sin enlaces simbólicos ni solapamiento con el checkout; se crea con modo0700. No reutilizar carpetas de corridas anteriores. El preflight rechaza sin stack y antes de crear infraestructura. Los puntos de adaptación del arnés deben existir; build CLI limitado a150s y resultados con señal/error se rechazan aunque status sea0. PUT Storage tiene30s y el inicio del transporte SYN10s reales, además del reloj lógico del timeout de producto.
