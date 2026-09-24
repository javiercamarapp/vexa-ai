# Portabilidad CRM observada — ensayo SYN local

Este recorrido demuestra operaciones existentes de identidad y comparación entre dos fuentes representadas por fixtures explícitas HubSpot/Zendesk. No contacta CRM, no usa cuentas cliente ni acredita cobertura de sus feeds remotos. No es el ensayo humano de F08-03 ni una migración del CRM del cliente.

## Qué se observa

1. HubSpot aporta las conversaciones SYN `42` y `99`; Zendesk aporta `142` y `199`. Son cuatro identidades de origen hasta que el owner confirma el crosswalk explícito `42=142`, `99=199`. Coincidencias de texto o email no producen la unión.
2. Dos órdenes financieras SYN de USD100 y USD200 están vinculadas a ambos pares. La asociación financiera se prepara en la fixture local, no se infiere de los conectores. El replay conserva IDs/revisiones; tras los aliases hay dos conversaciones resueltas, cuatro fuentes y dos órdenes: USD300, delta0. No se suman los USD15 de refunds de otra demo ni se afirma ahorro.
3. `hubspot_1000` y `zendesk_email` conservan su procedencia. No se declaran canales equivalentes. La llegada o desaparición de uno marca `no_comparable`; perder cobertura no acredita mejora.
4. Una tercera orden SYN tiene importe desconocido: total `null`, subtotal conocido USD300. El panel muestra «desconocido», nunca cero. Comparable describe el método; no inventa un delta monetario cuando falta un importe.
5. La organización B autenticada recibe rechazo409 al pedir cortes o proponer un alias de A; su listado propio está vacío. El baseline original conserva exactamente sus bytes.

La fixture ingresa páginas locales a `runSync` y persistencia real; no prueba transporte ni paginación contra proveedores. Las órdenes se siembran con versiones financieras SYN. La fase de canal perdido modifica exclusivamente el dataset descartable para representar una exportación sin la fuente anterior: no ejecuta una eliminación real ni un proceso de retención.

## Reproducir sin cuentas externas

Desde un checkout con estos helpers, Node22.23.2 o Node26.7.0, Docker con las imágenes del harness F03-06 disponibles y dependencias npm ya cacheadas:

```bash
mkdir -m 700 /tmp/vexa-portabilidad-evidence
node packages/connectors/tests/portability-demo.mjs /tmp/vexa-portabilidad-evidence
```

El helper exige los seis puertos locales61620–61625 libres antes de iniciar. Reutiliza infraestructura de pruebas F03-06, instala/compila en TMP y crea Auth/PostgreSQL/Storage/Chromium propios con un journal privado de propiedad. El `finally` elimina recursos propios y conserva `cleanup.json`. No ejecutar en paralelo con otro proceso que use esos puertos. El directorio de evidencia debe ser nuevo, privado y ajeno a una carpeta sincronizada/publicada.

El navegador abre `/migrations`, reconoce headings/labels y usa los controles reales de propuesta y confirmación de alias. Compara los cortes mediante los selectores Antes/Después. API y SQL verifican los resultados; las capturas son apoyo visual, no sustituyen los oráculos. Las sesiones y credenciales sólo existen en infraestructura SYN efímera; no copiar logs de entorno ni cookies a entregables públicos.

## Evidencia y límites

`portabilidad-crm-resultados.json` registra el corte probado, huellas, comandos/resultados y las capturas revisadas. El paquete privado conserva fixture, respuestas, snapshots, logs, hashes y limpieza. Se entrega como evidencia técnica acotada; siguen pendientes feeds/autorizaciones reales, ensayo humano y aceptación formal F08-03.

## Reparación funcional encontrada durante el recorrido

La captura original devolvía403 (`database_permission_denied`) para un owner vigente. PostgreSQL identificó la política restrictiva `economic_snapshot_read`: su consulta estable por ID todavía no ve la fila nueva durante `INSERT … ON CONFLICT … RETURNING`. Quitar sólo `RETURNING` no bastó: `ON CONFLICT` también activa esa comprobación.

La reparación en `packages/connectors/comparability.mjs` conserva las políticas y la restricción única. Ejecuta INSERT simple bajo savepoint y lee luego por tenant/scope/input/policy en la misma transacción. Si una captura concurrente ya insertó el mismo corte, sólo23505 vuelve al savepoint y recupera esa identidad; los demás errores se propagan. Sin fila coincidente, el conflicto también se propaga. No se añadió SQL, grant ni privilegio global.

Los dos rechazos y un timeout de selector del control permanecen en evidencia privada. El selector se corrigió usando el nombre accesible observado del combobox; no hubo cambio de producto para ese timeout.

## Capturas SYN del recorrido local

- [01-equivalent](portabilidad-syn-01-equivalent.png)
- [02-provider-coverage](portabilidad-syn-02-provider-coverage.png)
- [03-channel-loss](portabilidad-syn-03-channel-loss.png)
- [04-unknown](portabilidad-syn-04-unknown.png)
