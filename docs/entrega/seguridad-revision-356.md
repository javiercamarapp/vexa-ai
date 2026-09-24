# Revisión de seguridad local356

Se cerraron tres hallazgos sobre3f7 más la composición revisada de ocho archivos. El manifiesto independiente tiene SHA256 `fc6b7673222408ab4181091d90377605649d4e7d44931de2828f4c2b83e5ec48`;57 archivos privados preservan controles, rojo original y limpieza, sin publicar sesiones.

- Una sesión de invitación rechazada con403 emitía cookie; ahora sólo se entrega después de verificar identidad final e invitación. El mismo rechazo deja cero cookies y el workspace responde401. La invitación válida conserva aceptación explícita y rol. Revisión Node22:3/3; composición Node26 incluye estos tres controles.
- Solicitudes repetidas por correo ante un upstream503 provocaban cinco intentos upstream. La admisión local limita una dirección normalizada por minuto, ocho operaciones simultáneas y256 direcciones por minuto; un503 o fallo de transporte abre circuito local60s. Las direcciones se conservan sólo como HMAC con clave efímera del proceso. Cinco solicitudes ahora producen un intento y la misma respuesta202; tras61s una nueva solicitud explícita produjo un correo en Mailpit. No se observaron cinco correos ni bypass de cuotas de GoTrue en el rojo.
- Next y eslint-config-next pasan de16.3.5 a16.3.6. Se verificaron las entradas de esa familia en el lock, lint y build. [Aviso oficial](https://nextjs.org/blog/nextjs-security-update-september-22-2026). No se identificó en VEXA una ruta ImageResponse que demostrara explotación del aviso.

La focal compuesta Node26 pasó5/5; las cuatro unitarias de admisión y la compilación Node22 también pasaron.18 recursos de tres corridas fueron recogidos. Los fallos anteriores y una corrección de oráculo403 permanecen separados; no se reetiquetaron como corridas verdes.

La admisión es por proceso: otro proceso o un reinicio tienen un contador nuevo. No sustituye cuotas distribuidas, políticas reales de Auth, WAF ni configuración del operador. No hubo correo externo, prueba del CDN real, inferencia pagada, despliegue ni aprobación global. La revisión excluye expresamente F06-09 y sus propuestas bloqueadas.43/60 técnicas y25formales permanecen sin cambio.
