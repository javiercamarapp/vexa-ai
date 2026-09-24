# Smoke de un destino autorizado

Este ejecutor prueba el producto por HTTP y navegador. No despliega, aplica SQL, provisiona cuentas, inicia modelos ni concede permisos. Su implementación y ensayo local no significan que F08-02 haya ocurrido en un destino remoto.

## Preparación del operador

1. Obtener autorización real y específica para la URL, revisión, dos tenants efímeros **SYN**, importaciones de ensayo, exportación y los controles de consumidor/revocación. Conservar su referencia verificable. El JSON de entrada declara esa autorización; **no es una firma ni demuestra por sí mismo que una persona haya autorizado nada**. No completar el campo con un consentimiento ficticio.
2. Partir del manifiesto generado por `packages/release/manifest.mjs`. Vincular su `destination.url` al origen HTTPS exacto aprobado. Compilar el destino con `VEXA_BUILD_REVISION=source.commit_sha`; cambiar la variable al arrancar no corrige un build distinto.
3. Provisionar las cuentas y sus permisos mediante el procedimiento autorizado del destino. A necesita leer/exportar el alcance e importar en su conexión; B necesita leer sus propios recursos y carecer de membresía en A. Iniciar sesiones legítimas y recientes por el flujo Auth del destino. Guardar sus cookies privadas, incluido `vexa_active_org`, en el archivo0600. No entregar claves de servicio ni tokens de administración al smoke. El ejecutor vuelve a consultar Auth/pertenencia mediante los APIs del producto.
4. Preparar el fixture con los contratos existentes de `support/F06-detail/fixtures.mjs`: órdenes10000+20000, refund2000 y reversal−500, asociaciones y publicación aprobadas, mismo scope/hash, cliente canónico vinculado, recomendación/intervención y brief reales. El importe en texto no crea un ledger. En remoto esta preparación requiere APIs y permisos de provisión independientes; el smoke **no ejecuta el SQL del fixture local**. El operador entrega los IDs reales y un problema de B comprobable por B. Si no existen, la entrada está incompleta; no sustituirlos por IDs inventados.
5. Disponer de un consumidor de ingesta real, autorizado y con heartbeat. Preparar un medio operativo legítimo para pausar únicamente ese consumidor después de admitir un job, reanudarlo y revocar la membresía de A. El runner no ejecuta comandos, SQL, URLs de control arbitrarias ni hooks. Si no se puede hacer de forma acotada, esa fase queda bloqueada.

Crear directorios privados0700 para entradas, coordinación y una salida nueva. Los tres JSON de entrada deben ser archivos regulares0600, sin symlink. Las sesiones no aparecen en recibos, URLs ni capturas. Las capturas sólo son apropiadas para estos tenants SYN; no apuntar el smoke a cuentas con información personal o comercial real.

## Entradas

`authorization.json` usa este esquema; los marcadores deben reemplazarse por datos y aprobación reales:

```json
{
  "schema":"vexa-smoke-authorization-v1",
  "id":"<referencia única>", "operator":"<responsable>",
  "approvalReference":"<autorización comprobable>",
  "confirmed":true, "syntheticOnly":true,
  "environment":"remote-authorized",
  "expiresAt":"<UTC; vence en menos de24h>",
  "releaseSha":"<40hex del manifiesto>",
  "origin":"https://<destino exacto>",
  "storageOrigin":"https://<Storage aprobado>",
  "tenants":["<UUID A>","<UUID B>"],
  "operations":["read","import_syn","export_syn","pause_consumer","resume_consumer","revoke_A"]
}
```

`config.json`:

```json
{
  "origin":"https://<destino exacto>",
  "storageOrigin":"https://<Storage aprobado>",
  "accounts":{
    "A":{"tenantId":"<UUID A>","cookies":[{"name":"<cookie Auth legítima>","value":"<privado>"},{"name":"vexa_active_org","value":"<UUID A>"}]},
    "B":{"tenantId":"<UUID B>","cookies":[{"name":"<cookie Auth legítima>","value":"<privado>"},{"name":"vexa_active_org","value":"<UUID B>"}]}
  },
  "fixture":{
    "connectionId":"<conexión A>","problemId":"<problema A>",
    "customerId":"<cliente A>","briefId":"<brief A>",
    "foreignProblemId":"<problema B>","foreignCustomerId":"<cliente B>",
    "query":"date_start=...&date_end=...&timezone=UTC&date_basis=occurred_at&currency=USD&basis=...&snapshot_id=...&scope_hash=...",
    "expected":{"exposureMinor":"30000","refundMinor":"1500","currency":"USD"}
  },
  "controlDirectory":"<ruta privada absoluta0700>",
  "timeoutMs":120000,"operatorTimeoutMs":120000
}
```

El runner genera su propio CSV SYN de3filas con identidades nuevas. Las cuentas no deben compartir sesión ni tenant. Los orígenes no admiten credenciales, query, fragmento ni path. HTTP sólo se permite para `environment=local-owned` y loopback, destinado al adaptador local; no habilita un destino remoto.

## Ejecución

Preparar una copia del ejecutor con `playwright-core` disponible como dependencia y un Chromium compatible. Registrar las versiones instaladas con la evidencia de la ejecución; no instalar dependencias en el checkout de release. El package declara esa dependencia de operador. Se puede usar un navegador local ya preparado por CDP; el endpointCDP sólo admite loopback.

```sh
node /copia/packages/release/smoke/cli.mjs \
  --release /privado/release.json \
  --authorization /privado/authorization.json \
  --config /privado/config.json \
  --out /privado/smoke-nuevo \
  --cdp http://127.0.0.1:9222
```

Sin `--cdp`, Playwright debe tener disponible su Chromium local. No se usa una variable de entorno como autorización. Los redirects HTTP no se siguen; el navegador bloquea requests fuera del origen de la app. El upload firmado sólo puede ir al origenStorage autorizado y no recibe cookiesAuth de la app. La capacidad firmada no se escribe en logs.

## Protocolo de coordinación

El directorio de control recibe `<id>.request.json` con `runId`, `id`, `authorizationId`, `tenantId`, `action` y vencimiento. No es evidencia de que la acción se haya realizado. Tras verificar y ejecutar la operación autorizada, el operador escribe un nuevo archivo0600 `<id>.ack.json` con esos mismos identificadores y `completed:true`.

- `arm_pause_after_admission`: preparar un mecanismo acotado para detener al consumidor cuando se reciba el siguiente pedido. Mantener un heartbeat válido para admitir el job.
- `pause_consumer`: contiene el `jobId` ya admitido y su `importId`. Pausar exclusivamente al consumidor autorizado antes de que ese job termine. Si se pierde la ventana no hay prueba satisfactoria del fallo; no modificar el estado del job para simularla.
- El runner verifica por HTTP que el job permanece no terminal, conserva checkpoint/pendientes, aparece `NO_HEARTBEAT` y una nueva admisión devuelve503. Un202 jamás acredita procesamiento.
- `resume_consumer`: reanudar el consumidor. El runner exige que **el mismo job** llegue a succeeded, con3aceptadas,0rechazadas,0duplicadas y0pendientes. No reimportar para esconder el job detenido.
- `revoke_A`: revocar la membresía de A en el tenant de ensayo. El runner exige denegación actual de lectura/export y que B continúe autorizado. No revocar B ni recursos compartidos.

La caducidad se comprueba antes de cada nueva solicitud HTTP, request del navegador y pedido de control. El vencimiento de un control normal nunca excede la autorización. Una operación ya enviada puede haber tenido efecto; caducar no la cancela ni autoriza repetirla.

Si falta una confirmación se registra `blocked` y exit2. Desde que solicita armar una pausa, el runner conserva una obligación de limpieza aunque no llegue el ACK. Tras fallar con un consumidor posiblemente pausado, solicita únicamente reanudar ese consumidor de esa corrida/tenant como compensación, incluso si venció la autorización; identifica `compensating:true` y el vencimiento original. El operador debe verificar esa correlación; no permite nuevas lecturas, imports, pausas ni revocaciones. Esa limpieza no vuelve favorable una corrida fallida; si tampoco se confirma, conserva el bloqueo y el operador debe resolverlo. Los recibos sólo cuentan como coordinación: las afirmaciones dependen de respuestas del producto.

## Resultado y límites

`report.json` distingue pass/fail/blocked por fase, SHA esperado/servido, IDs técnicos, hashes de export/capturas, trazasUUID y códigos sanitizados. No exporta bodies de error, texto de mensajes, cookies, cabeceras de autorización ni URLs de upload. Salida0 requiere todas las fases;1 es fallo y2 bloqueo. Un proceso terminado,200genérico,202o ACKoperador no bastan.

El ensayo local reutiliza Auth/PG/Storage, consumidor y fixtures existentes:

```sh
node packages/release/smoke/tests/local.mjs /ruta/candidato
node --test packages/release/smoke/tests/contract.test.mjs
```

El adaptador local es provisión exclusiva de recursos propios62420..25. No forma parte del CLI remoto. La prueba no adopta propuestas de notificaciones ni reabreSQL09/299. F08-01, destino/credenciales/autorización reales, revisión independiente, smoke remoto efectivo y aceptación formal siguen siendo pendientes externos distintos.
