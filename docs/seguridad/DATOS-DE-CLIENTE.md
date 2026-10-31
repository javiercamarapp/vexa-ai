# Datos de cliente en el repositorio

Este repositorio es público. Los datos de un cliente (nombre comercial, dominio, identificadores de su organización en producción, huellas de sus archivos, cifras de su operación, nombres de sus proveedores y de su equipo) **no se versionan nunca**, aunque el cliente haya autorizado usarlos para operar el producto.

## Reglas

1. Los datos reales de un cliente piloto viven en `config/cliente-piloto.local.json` (ignorado por git) o en `~/.config/vexa/cliente-piloto.json`. El archivo versionado `config/cliente-piloto.ejemplo.json` es genérico.
2. El identificador de la organización de producción se lee de `VEXA_TENANT_ID` o de la configuración local; no hay un valor real en el código.
3. Las pruebas y fixtures usan datos sintéticos (organización de ejemplo, SKU y marketplaces ficticios, correos `*.invalid`/`*.test`). Si una cifra de una prueba parece derivada de un cliente real, se reemplaza por una sintética.
4. Los documentos describen órdenes de magnitud o estados, no importes ni conteos reales de producción.
5. Los PDF, capturas y videos versionados deben ser sintéticos o genéricos; se revisan antes de subirlos.
6. Las fuentes web de terceros no se copian al repositorio (derechos de autor y ruido).

## Guarda automática

`tests/seguridad/datos-de-cliente.test.mjs` (`npm run test:datos-cliente`) falla si en archivos versionados, o nuevos sin ignorar, reaparece el nombre comercial del cliente, su dominio, el identificador de su organización o la huella de un archivo recibido. También revisa el texto de los PDF versionados (si `pdftotext` está disponible) y que el ejemplo de configuración sea genérico. Una excepción exige justificarla en la propia prueba.

## Si aparece un dato de cliente

1. No lo borres solo del último commit: el historial público lo conserva.
2. Avisa al titular del repositorio; el historial se limpia reescribiéndolo y recreando el repositorio, no con un commit nuevo.
3. Rota cualquier credencial que haya quedado expuesta.
