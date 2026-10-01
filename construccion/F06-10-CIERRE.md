# F06-10 — correo aceptado y migración remota comprobada

**56/60 tareas técnicas; 27 aceptadas formalmente. Producción pendiente.** Correo integrado en `145703632d4e5e93b9d42c85b39671cf5f06da1b` después de revisión independiente y aceptación desde Git limpio.

El consumidor puede enviar correo HTML/texto a usuarios VEXA confirmados mediante Resend o SMTP local. Revalida permisos, política, emisor, preferencias y recurso inmediatamente antes de admitir el envío. Quejas y rebotes permanentes generan una supresión durable vinculada al buzón enviado; cambiar preferencias o recibir un delivered tardío no la elimina. El receptor usa firma SDK sobre el cuerpo original, límite de tamaño/tiempo, protección contra replay y mapping interno; el payload externo no selecciona organización ni destinatario. Accepted permanece distinto de delivered.

La plantilla comparte marca con la web/Auth: verde, blanco y negro; membrete, CTA centrado y texto alternativo. Logo definitivo pendiente. Reply-To opcional validado. El worker compilado incluye la configuración común de marca.

| Comprobación | Resultado | SHA256 del recibo |
| --- | --- | --- |
| Verificación oficial Node22 | 39/39 + 25/25 pruebas hijas | `5a366641f55df60b3625c7509297dbfea7001c3a776c1ae46fdc8902be7602d5` |
| Aceptación desde Git limpio Node22 | 39/39 + 25/25 pruebas hijas | `4c019937e277ba13e986cb5de267a34572170c99cea14d0df2dcd39358f27f34` |
| Revisión independiente420 | Aprobada para verificación formal | `ca69c8924a904d3d972eccf3e330b7723f5d6d974dc1e9307cfa3b30efe9726b` |

Los39 controles incluyen24grupos SQL de revocación/supresión, SMTP real local, Next y recibos. Las25pruebas hijas se contabilizan por separado. Además se verificaron permisos y cinco claves foráneas en la extensión focal de la matriz; no se repitió ni se atribuyó la matriz432anterior a este cambio. Presentación:56variantes y8capturas del correo real local en Chromium/WebKit; gate portable4variantes en Chromium aislado. Recursos temporales eliminados. Base24/24 y controlador134/134 aprobados.

El primer ensayo limpio se conserva con37/39: una variable heredada de Node impedía ejecutar las pruebas hijas, y el examen detectó la omisión. Corrección mínima del entorno hijo y prueba afectada25/25; las dos ejecuciones oficiales posteriores pasaron completas. También se conservan los fallos de configuración del navegador y del fixture auxiliar, sin tratarlos como bugs del producto.

## Supabase y publicación

Migración0030 aplicada legítimamente por MCP, versión `20261001033338`, SQL SHA256 `d89a4045940450896889995b100ef0a34631db986a63fbd56910b27a1641d3d6`. Tres tablas con RLS forzado,105combinaciones de privilegios de tabla y30de funciones comprobadas: cero concesiones inesperadas. Rol de correo sin login, herencia, superusuario, bypass ni membresías de aplicación. Cero mensajes/recibos/supresiones remotos; no se envió correo externo.

Publicación por publisher autorizado, conservando commits coherentes; el recibo remoto se registra después del push. Vercel todavía conserva `d39e9a3` al preparar este cierre; despliegue de esta versión pendiente de comprobación. GitHub Actions desactivado y Vercel sin enlace Git automático.

## Pendientes reales

Para correo: proveedor y remitente propios, dominio con DNS, secreto del webhook, credencial dedicada del servicio y prueba de entrega a buzones autorizados. La configuración dedicada puede completarla el operador con los accesos apropiados; no es necesariamente un dato del cliente. Los correos Auth de Supabase tienen su propia configuración remota pendiente. No se acredita Resend real, Gmail/Outlook/Apple Mail ni entregabilidad por pruebas de navegador.

Quedan F06-11(push), F06-12(eventos), F06-07(interfaz global) y F07-01(seguridad global), además de comprobaciones integradas y auditoría final de20rubros. Datos históricos, cuentas, permisos y evaluación humana del cliente permanecen explícitos. La lista de configuración del módulo está en [EMAIL.md](../packages/notifications/EMAIL.md).
