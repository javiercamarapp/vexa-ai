# Piloto histórico de 100 mensajes: preparación y límites

**Ejecutor preparado y comprobado localmente; carga real pendiente de autorización.** El lote conserva 100 identidades nativas, 65 mensajes de cliente y 35 de agente. No se ha subido ni ejecutado en producción. La versión vigente v6 pasó 44 pruebas ligeras y ocho del ensayo integrado (siete casos más agregado), sin omitidos. Auth, PostgreSQL/RLS y Storage son reales locales; las 100 filas del ensayo son sintéticas.

La revisión independiente comprobó los hashes de las fuentes y los artefactos. El contrato puro volvió a ejecutarse con Node 22.23.2 contra las fuentes congeladas `6e8b2b4`: preview 100 aceptadas y cero rechazos; normalización y adaptación durable coinciden en las 100 filas. Conserva las celdas y las fechas originales. La representación canónica normaliza 84 fechas; no altera sus valores originales. La revisión durable usa el hash del payload y conserva el hash nativo en las celdas de origen.

Hay **cinco pares, diez filas, con iguales conversación, rol, fecha y texto, pero distintos IDs nativos y de nota portadora**. También coinciden autor y canal en sus metadatos de origen. Esto requiere revisión explícita antes de cargar: no acredita cinco duplicados confirmados ni autoriza fusionarlos o descartarlos. Los 100 IDs son únicos, pero la deduplicación semántica no está acreditada.

La lectura de producción confirmó una conexión CSV activa y ningún trabajo propio en estado queued/running en ese corte. Es una observación puntual: antes de una carga autorizada se deben volver a comprobar conexión, identidad, solapamiento de IDs nativos y portadores, y compatibilidad del despliegue. El código remoto observado sigue siendo anterior al candidato local. Ninguna lectura equivale a autorización de escritura.

La comparación estática entre el despliegue observado `b0be6df` y el candidato `6e8b2b4` encontró 119 archivos idénticos en los contratos de importación, runtime/consumidor, ingesta, plataforma y autenticación revisados. Las versiones de Supabase SSR/JS y PostgreSQL cliente también coinciden. El adaptador Next sólo añadió el límite de 8.192 bytes para metadatos; el CSV se sube directamente a Storage. La migración 0041 preserva esa carga firmada y la descarga autenticada. Esta revisión acredita compatibilidad de fuentes en ese alcance, no ejecución remota; la versión servida y las autorizaciones deben volver a comprobarse antes de escribir.

El ejecutor se limita a un solo trabajo del lote aprobado, con 100 registros y un único bloque. Si la consulta encuentra otro trabajo, aborta dentro de la transacción antes de cualquier actualización. No utiliza el consumidor global ni modifica trabajos de otras organizaciones. La carga, el procesamiento y la lectura posterior requieren autorización específica y una identidad ya autorizada.

La lectura de las 10:47 UTC encontró una delegación de analista activa, pero el último latido de ingesta era del 6 de octubre. V6 puede iniciar un consumidor temporal real mediante un único latido canónico de arranque, si la aprobación lo permite, no hay importaciones activas en todo Senix y la única alarma es `NO_HEARTBEAT`. La prueba integrada verificó primero el rechazo 503 sin crear una importación, después el arranque y el recorrido completo con 100 filas. No se deshabilita la admisión ni se altera el producto.

**Límite operativo:** ese latido permite admisión en todo el tenant durante hasta 60 segundos. Pueden aparecer reservas concurrentes que este ejecutor no atenderá; vuelve a comprobar la cola y se detiene ante otro trabajo. Las renovaciones normales del trabajo aprobado conservan sus controles. No acredita un servicio permanente. Ante interrupción, guarda efectos inciertos y exige conciliación; no reintenta automáticamente. El supervisor limita el intento a 120 segundos, con 20 segundos desde el consumo y un segundo explícito de gracia para terminar su proceso.

La prueba integrada terminó en 14,52 segundos; el consumo sintético de 100 filas tardó 1,16 segundos. Cotejó las 100 identidades, revisiones, hashes y procedencia, repitió la reserva sin duplicar filas y rechazó un usuario y un trabajo incorrectos. Root verificó los hashes de 12 archivos de control, seis artefactos y 3.285 archivos de la copia instalada, y comprobó que los cinco recursos de Docker y los cinco puertos estaban libres. No es una prueba del CLI completo contra producción ni un rendimiento remoto.

La copia aislada de `6e8b2b4` ya tiene dependencias instaladas offline con Node 22.23.2. El plan exacto preparado es `history-pilot-executor-v6/preparation-v6-final.json`, SHA256 `e94263c4496dd063f4c57fafd9b74e8a9bf98ba8174a5fa5c02bc3ba28ec9beb`, bajo `~/.codex-work/rovaq-cierre-20261007/`. Conserva `uploadReady:false`: el plan no concede autorización.

Comando futuro, sólo después de registrar el OK real para este lote, el arranque temporal y la conservación de los cinco pares, con referencia auténtica de autorización de los datos:

```sh
cd /Users/javiercamaraportepetit/.codex-work/rovaq-cierre-20261007/history-pilot-executor-v6
/opt/homebrew/opt/node@22/bin/node run.mjs execute \
  --plan "$PWD/preparation-v6-final.json" \
  --approval /RUTA_PRIVADA/aprobacion-real.json --approval-sha256 SHA256_REVISADO \
  --overlap /RUTA_PRIVADA/solapamiento-fresco.json --overlap-sha256 SHA256_REVISADO \
  --credentials /RUTA_PRIVADA/credenciales-autorizadas.json \
  --output "$PWD/ejecucion-UNICA.json"
```

Las rutas y hashes pendientes corresponden a documentos que sólo pueden completarse con autorización real y un cotejo de solapamiento de menos de 60 segundos. No se generan aprobaciones favorables, firmas humanas ni secretos de ejemplo. El README privado fija el contrato `history-pilot-approval-v2`, una autorización de arranque como máximo y las comprobaciones de origen, identidad, conexión y versión antes de escribir.

Evidencia privada, sin contenido de clientes en este documento:

| Artefacto | SHA256 |
|---|---|
| CSV del piloto | `f61f6b6c6d791f7162c0a35d1fc4d1f432d1cb049329516d8c73a0023fd4907c` |
| Revisión independiente de preparación | `8bb2216e2dbe282d948fdd9967e072e7716a42ecd5d74a39f58ecb14833c2537` |
| Contrato Node 22 sobre 6e8b2b4 | `c27c1d3101426ada752dee09f3869eb4c4d958194d30a3a79a7c6bd7508a7de6` |
| Auditoría de igualdad | `20c762afe696b52db357bfef13b13926bee71a8f06bab699376d6d89e62c2e19` |
| Comparación de procedencia de los cinco pares | `b41d655ac035f9f7319a295c1d0c26857b6993c5f169dd258e142d0a185b90e9` |
| Conexiones y trabajos, sólo lectura | `2a266fb8c5cd9691d542abf1517eebba3931ade7d3e3ce50f5eca800bdd0c8e6` |
| Compatibilidad estática de los contratos de importación | `04576f652275d79d3c97eccee8d32cc2a977447b6eb84b485ca600d511f0c72a` |
| Salud de ingesta, sólo lectura | `50a01cad803a53ee521beeee927a71f1dea0d1d1d9b7032c49c4a02356b185ac` |
| Snapshot v6 revisado | `ad223a0d92d32dd9dffb72b0993d209dcc300c5059435bcd2c7dc3a5e4a7ded4` |
| Revisión del ensayo integrado v6 | `0db1bc4d7758e5794836488d112c7eeb23580da8fb2c9f306e22bcd42b6ced04` |
| Cotejo independiente de root | `6b9b52e4a6259783e8d1581c6df926915a056fcb4eebb17f2999edfba06c0363` |

Los recibos están en `~/.codex-work/rovaq-cierre-20261007/history-reconciliation/` y `history-pilot-executor-v6/`. V5 y sus resultados 31/31 más 7/7 se conservan como la versión previa que requería un consumidor ya saludable; no se reetiquetan como v6. Los originales de `private/` permanecen intactos. Esto no sustituye la referencia independiente del gate CRM, la aceptación humana ni el piloto comercial. El contador formal continúa en 28/60.
