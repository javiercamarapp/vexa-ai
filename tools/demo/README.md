# Respaldo sintético local

Herramientas de captura y verificación de la demostración F08-03. No cambian código del producto ni llaman a proveedores de inferencia. Requieren el checkout de la versión declarada, los fixtures y harness locales existentes, Docker con imágenes cacheadas, Node, Chromium/Google Chrome y FFmpeg/ffprobe locales. Instalar/construir ocurre en el temporal del harness, no en el checkout. Puertos propios:62420..25; no ejecutar si otra tarea los usa.

```sh
VEXA_CANDIDATE="$PWD" node tools/demo/record.mjs
# Usar la ruta EVIDENCE impresa por la captura:
node tools/demo/render.mjs "$DEMO_EVIDENCE" "$PWD/docs/entrega/demo-backup.webm"
node tools/demo/offline.mjs "$DEMO_EVIDENCE" "$PWD/docs/entrega/demo-backup.webm"
```

`record.mjs` conserva video continuo nativo, capturas de diagnóstico, tiempos, navegación, respuestas POST y comprobación del export. Limpia sus recursos al terminar. No declara que un raw capturado ya sea un respaldo verificado. `render.mjs` limita el render a la duración real del raw, superpone el rótulo PNG en todos los frames, normaliza a10fps VP9 y decodifica el resultado completo. `offline.mjs` abre el WebM en un contexto de navegador aislado con red deshabilitada, reproduce y recorre nueve instantes.

El rótulo y subtítulos son sólo material de grabación. No editar valores de la aplicación ni eliminar errores mediante montaje. Si falla una acción, conservar su salida y no presentar esa corrida como completa. El manifiesto de entrega identifica por SHA el video revisado; otra captura requiere nuevos hashes y revisión.

Las rutas de binarios de render/verificación corresponden al Mac local usado en este recibo (`/opt/homebrew/bin` y Google Chrome). No ejecutar contra producción o datos de clientes. La copia de Playwright para el verificador procede del contenedor propio del harness, se conserva sólo en el temporal y no se publica como dependencia del producto.

El respaldo final tiene revisión independiente y reproducción offline verificadas. La extracción del script de captura sin el renderer obsoleto pasó revisión y comprobación de sintaxis; no se repitió la toma completa con ese archivo extraído. El ensayo humano de cinco minutos y la aceptación formal siguen pendientes y son distintos de la duración del archivo. No se acredita precisión, eficacia de intervención, portabilidad CRM, PMF ni producción.
