# Correos centrados y confirmación de organizaciones — 30-sep

**Publicado y desplegado:** `d39e9a3a73935d7caf18d88073d9b2537ef6ebd7`, READY en [VEXA AI](https://vexa-ai.vercel.app). SHA servido y fuente subida verificados. Se mantienen **54/60 técnicas, 25 formales y producción pendiente**.

## Cambios y pruebas

Los botones verdes de las cinco plantillas Auth con acción están centrados mediante alineación de tabla y margen automático. Se conservaron enlaces, variables de Supabase y contenido. Las otras ocho plantillas no cambiaron. Revisión independiente 406 aprobada: 10 comprobaciones de los mecanismos de alineación por separado con Node 22; antes, root ejecutó 15 tests existentes y 20 presentaciones focales con Node 26. Los 52 renders previos mantienen sus hashes anteriores. Hay vista previa y patch preparados localmente; la configuración remota de plantillas y el remitente propio siguen pendientes de acceso a Auth Management. Publicar en Vercel no aplica esos HTML al servicio de correo.

El formulario de creación de organizaciones conservaba una confirmación marcada después de editar nombre o responsable. Ahora cualquier edición la invalida y una creación exitosa la limpia. Autor 407 reprodujo el fallo y comprobó la corrección en Chromium 1440/390 con la misma prueba. Root revisó el único archivo y añadió WebKit 1440/390: editar, revertir, reconfirmar por teclado, impedir envío sin consentimiento, enviar una vez con datos actuales y exigir nueva confirmación para la siguiente organización. Son fixtures de API explícitos; no prueban una nueva transacción real de creación. Lint y compilación exacta Node 22 aprobados.

El ensayo remoto usó la aplicación desplegada con una cuenta sintética propia: comprobó ambos tamaños en WebKit, invalidación por nombre/correo, teclado y ausencia de desbordamiento. Se bloquearon preventivamente los POST de creación: hubo **cero intentos**. Logout completado, permiso temporal revocado con auditoría y cero sesiones restantes. No se enviaron correos ni se crearon organizaciones. La primera compilación local, anterior a copiar el parche por un error de ruta del script, se conserva y no se acredita al cambio; la compilación posterior verificó el hash correcto. También se conserva el fallo inicial de infraestructura del autor por versión de WebKit Python ausente.

## Qué sigue faltando

El inventario 408 no produjo código ni aceptación. Confirmó que el producto publicado aún no integra registro de dispositivos, interfaz de suscripción, service worker ni endpoint Push. Existe una propuesta previa referenciada que depende del cierre F06-09; no fue reconstruida ni transferida desde el ámbito excluido. Faltan integración técnica y gate, además de VAPID, configuración y consentimiento real. VAPID puede configurarlo el operador cuando el código esté listo; no se presenta como un dato que necesariamente deba suministrar el cliente.

Las seis fichas pendientes siguen siendo entrega de notificaciones F06-09, correo F06-10, push F06-11, integración de eventos F06-12, interfaz global F06-07 y seguridad global F07-01. Los correos Auth no sustituyen los correos de eventos de negocio. No basta aportar APIs o información histórica para cerrar todavía esas seis fichas ni la auditoría final de 20 rubros.

## Publicación y trazabilidad

Commits coherentes conservados: `a189e90` (centrado de correo), `0129fb5` (evidencia de acceso) y `d39e9a3` (confirmación de organización). Cada publicación verificó SHA remoto y autoría asociada. Actions desactivado y Vercel sin vínculo Git; un despliegue manual autorizado para el cambio web. No se afirma costo total cero de infraestructura.

Los agentes 406–408 terminaron y sus resultados fueron recogidos: aprobación 406, reparación 407 integrada y diagnóstico 408 sin parche. Acumulado 408 sin reinicio. No quedan pruebas ni agentes de esta tanda ejecutándose.

| Evidencia | SHA256 |
| --- | --- |
| Revisión del centrado | `9c73526428a5efdc8b3185e283a25204efd4957af14fc52c523df6101207b84e` |
| Fuente de confirmación | `f2a478db78d66b0af1f9c2e8064145d7fbb3037501563eb8acbaff7b46b03282` |
| Revisión independiente de confirmación | `d1324102209f7d34c5b402e43cc0dd96eb9f004188224b93395b44889600aa47` |
| Prueba remota | `7b73e20764722043b97f5b5d927a0d8eb5373d47ebdaa5bb0edb8225c8a78645` |
| Despliegue | `e798bd2a8053fb3260fb77819ed1ed9729448567ee1f819d136652726d851afe` |
| Limpieza sintética | `deb62f5df173a5382ddcc012d41b9132ca906caa4d28a5aff44e4f95d3472968` |
| Inventario push | `ba0197466536e38d6718f0769d26b6f3bafb82269947b3f26b8211ef16fd2ebc` |
