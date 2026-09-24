# Demostración de respaldo — VEXA

Recorrido automatizado del producto real en infraestructura local efímera con datos **SYN**. El archivo `demo-backup.webm` es un respaldo visual; no es un feed en vivo, un piloto de cliente ni una aprobación de producción. La versión exacta, duración, codec, hashes y comprobación offline están en `demo-backup-manifest.json`.

El rótulo **DEMOSTRACIÓN SINTÉTICA · RESPALDO GRABADO · NO ES UNA SESIÓN EN VIVO** permanece en todos los fotogramas del video. Los subtítulos explicativos y ese rótulo pertenecen al controlador de grabación, no son funciones de la aplicación. Los valores y estados del producto no se editaron.

La toma final usa `recordVideo` de Playwright sobre el navegador real. La codificación de entrega normaliza el video a diez fotogramas por segundo y añade el rótulo permanente; no altera las cifras ni sustituye acciones con pantallas fabricadas. Se conserva una captura inicial por fotogramas como diagnóstico, que no es el archivo de entrega. No incluye voz, música ni audio del equipo. El presentador puede usar el siguiente guion; **el ensayo cronometrado humano y la prueba de comprensión siguen pendientes**.

| Tiempo previsto | Recorrido grabado | Guion de explicación |
|---|---|---|
| 0:00–0:35 | Resumen, publicación y alcance | VEXA relaciona conversaciones con evidencia y registros operativos. En esta fixture hay 300 USD de órdenes vinculadas y 15 USD de reembolsos registrados. Son métricas distintas: no se suman como pérdida, ahorro ni retorno. |
| 0:35–1:05 | Problemas → detalle | Se conserva el mismo snapshot y scope. Las filas por problema pueden compartir órdenes y no son aditivas. La severidad y una cita no autorizan inventar un importe. |
| 1:05–1:30 | Componente → evento → evidencia financiera | Abrimos el registro aprobado y su procedencia. Una referencia verificable no demuestra que el problema causó el impacto. |
| 1:30–1:48 | Cliente | El vínculo canónico de este cliente SYN fue aprobado explícitamente. No se muestran identidades de clientes reales. |
| 1:48–2:10 | Explorador | Una pregunta acotada consulta los datos del alcance. Este recorrido usa la consulta determinista existente; no llama a un proveedor de modelos. |
| 2:10–2:50 | Recomendación → intervención → guardar plan | El responsable revisa hipótesis, población, baseline, resultado y límites del control. Guardar o aprobar no ejecuta una acción en un CRM. |
| 2:50–3:40 | Aprobar, registrar inicio/fin y medir | La ventana de medición es sintética y breve, sólo para ejercitar el software. El importe posterior es desconocido: el resultado permanece parcial, el delta no se inventa y no se permite cerrar la medición. No acredita eficacia ni ahorro causal. |
| 3:40–4:17 | Brief → descargar JSON | El brief conserva la publicación original de 300/15 USD. La descarga real coincide con el API en documento, id y content hash. El snapshot posterior de medición se identifica por separado y no reescribe el brief. |
| 4:17–4:42 | Histórico y gestión de problemas | Se muestran las pantallas reales y sus requisitos de configuración. No se autoriza un lote ni se inicia inferencia. Los límites de coste son controles operativos, no promesas de exactitud. |
| 4:42–5:00 | Regreso al resumen original | Sigue siendo una demostración sintética. Conectar cuentas autorizadas, validar con personas, realizar un piloto y ensayar el pitch son pasos pendientes distintos. |

El manifiesto registra los tiempos observados; esta tabla es el guion previsto, no una medición del habla de una persona. Las pausas permiten leer los estados reales antes y después de cada acción.

## Uso del respaldo

1. Abrir localmente `demo-backup.webm` en un reproductor compatible con WebM/VP9; el video no depende del servicio local ya eliminado.
2. Mantener visible su rótulo. Si falla el feed de una demostración, anunciar que se pasa al respaldo sintético grabado; no fingir continuidad en vivo.
3. Usar el SHA del manifiesto para identificar la versión. No sustituir silenciosamente el video ni sus importes.

No se muestra una equivalencia HubSpot/Zendesk: esta fixture no contiene una comparación de migración aprobada para el recorrido. Tener conectores y una fuente SYN no prueba portabilidad de un cliente real. Esa parte debe añadirse sólo con evidencia propia y una nueva grabación identificada.

La recomendación y el borrador de intervención se prepararon mediante el API real antes de la toma; la grabación muestra guardar el plan y sus transiciones posteriores.

Las extracciones y agrupaciones de preparación emplean los fixtures explícitos del repositorio; las respuestas sintéticas no son una medida de precisión. No hay datos de Senix, logos de terceros, campañas, envíos push/email, llamadas pagadas ni ejecución remota. No se acepta el dominio SQL09/299 por esta grabación. La revisión independiente del respaldo y la aceptación formal se registran fuera de este documento.

La [demostración adicional de portabilidad CRM](portabilidad-crm.md) ya cuenta con recorrido local SYN y capturas verificadas. Es un artefacto separado; no modifica ni añade ese recorrido al video anterior, ni demuestra una migración real del cliente.
