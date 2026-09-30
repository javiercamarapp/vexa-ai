# Botones y confirmaciones compartidos — 30 de septiembre de 2026

La interfaz adopta las proporciones de botones y confirmaciones de la referencia Atiende autorizada, conservando verde, blanco y negro. Los botones del contenido usan tipografía de14px/600 y bordes redondeados; el diálogo compartido tiene un ancho máximo de512px, radio8px, acciones alineadas al final en escritorio y apiladas en móvil. La entrada animada dura200ms y se desactiva al solicitar movimiento reducido. Los manejadores de acciones permanecen idénticos.

## Evidencia y alcance

La propuesta conserva lint y compilación Node22 aprobados,40 capturas del despliegue anterior y40 del preview (20rutas en Chromium1440 y WebKit390), sin errores JavaScript ni desbordamiento horizontal. El focal sobre los bytes finales confirma foco inicial, navegación con teclado, Escape y retorno de foco, cancelación sinPOST, estilos, movimiento reducido y navegación lateral en ambos motores. Son recorridos de lectura con datos sintéticos propios; no80 procesos de negocio ni validación productiva con cuentas reales.

La prueba original de WebKit detectó que la configuración del navegador omite botones conTab, comportamiento reproducido enHTMLnativo; el control correcto usaOption+Tab. Otra observación medía el ancho lateral antes de terminar la transición; el control final espera su ancho objetivo. No se cambiaron funciones para esconder estos resultados.

Manifiesto de producto:47e07ace3dd1598e4e250ee9980f671c017c6a5d4b637773b66b37680d2faf7c. Son exclusivamente globals.css y confirmation-dialog.tsx; no cambios de SQL, autorización, transportes ni entrega de notificaciones. Revisión independiente402 APPROVED_SCOPED, recogida y aplicada: manifiesto2fb519b5939da62869f6fa850ddeb3ad720cb1041b23bca67f4424f04a43f81f. Ocho escenarios adicionales deCSS aislado enChromium/WebKit a320/639/640/1440px y alto360, con texto largo y sin red, aprobados. No se repitieron lint/build ni pruebas de código inalterado. El agregado del preview conserva el campo revision del runtime anterior; la propuesta se identifica por base y manifiesto, no por ese campo.

## Límites de cierre

Se mantienen54/60 tareas técnicas y25 formales. Este ajuste visual no cierra por sí solo F06-07 ni acredita identidad pixel-perfect de todas las vistas. Entrega de notificaciones, correo, push, eventos y cierre global conservan sus bloqueos y dependencias; no basta añadirAPIs. La auditoría final integral y la aprobación de producción permanecen pendientes. El último smoke completo8/8 conserva su SHA b9ed3db; no se atribuye a esta versión.

## Publicación y comprobación remota

Commit `ccf546b3495ec8d8fb0e2c2886e3be842274696a` publicado por el publisher autorizado con Actions desactivadas; SHA remoto y autor/committer asociados comprobados. Vercel `dpl_6jUJNzjz6DUW61GhoFu5DUGsBXrN` READY, versión servida exacta y los dos archivos subidos coinciden con los bytes revisados. El despliegue exportó únicamente724 archivos públicos autorizados. En https://vexa-ai.vercel.app se comprobaron login200 y los diálogos reales enChromium1440/WebKit390: estilos, foco/teclado/Escape, cancelación sinPOST, movimiento reducido y menú lateral. Cero errores de página y cero solicitudes de mutación. Las sesiones sintéticas se cerraron.

402invocaciones acumuladas, sin reset. Publicación y despliegue verificados no equivalen a cierre productivo ni a un proceso constructor en segundo plano.
