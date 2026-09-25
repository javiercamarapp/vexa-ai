# Interfaz VEXA AI basada en Atiende —25-sep-2026

Referencia de estructura: Atiende-Agencia-AI, revisión `c07764fb820afbba4c70be1d7c48cf4bf0b21328`, con autorización explícita del usuario. Paleta verde, blanco y negro; marca textual VEXA mientras se reciben los logos. La URL de referencia publicada devolvió404: la comparación se realizó contra su código fijado, no contra una página remota disponible.

## Cambio integrado

Login de dos columnas, tipografía y recursos locales con licencias/procedencia, navegación lateral expandible y compacta, cabecera y menú móvil con acceso a todas las áreas. Las páginas de acceso, error y404 usan el mismo estilo. Formularios, tablas desplazables por teclado y confirmaciones de revocación/reautorización comparten presentación. Microinteracciones de120–220ms en el workspace; la preferencia de movimiento reducido desactiva animaciones y transiciones. Google y correo permanecen deshabilitados de forma explícita mientras falta su configuración propia.

Se conserva la operación real de cada control y su autorización. Cancelar, Escape y cerrar desde el fondo de una confirmación no envían la operación. Confirmar captura la acción y su versión; un doble clic no duplica el POST. Las preferencias de grupos se conservan al contraer y expandir la barra lateral.

## Evidencia delimitada

- Revisión379:14grupos con Auth, PostgreSQL, correo local y navegador;29controles HTTP de acceso, lint/build/tipos. Navegación, cambio de organización, cierre de sesión, notificaciones y menús móviles comprobados.
- Autoría380: inventario de29rutas,84archivosTSX y582sitios de controles, incluidos163botones,52formularios y65enlaces. Es un inventario de código, no582acciones E2E. Las páginas/estados adversos se ensayaron con transportes sintéticos rechazados; no se confunden con servicios reales.
- Revisión381: Auth/SQL/Storage locales reales, export financiero de300.00USD expuestos y15.00USD reembolsados en datosSYN, CSV de3filas hasta succeeded3/3, tablas de migración y confirmaciones contra API/DB. Los conflictos de versión devuelven409, cancelar produce cero POST y el doble clic uno. La reautorización histórica no ejecutó inferencia.
- El gate oficial F01-04 se ejecutó intacto: tres grupos aprobados, incluyendo estados, teclado, navegación de ocho vistas y permisos de cuatro roles. La matriz de29rutas cubre320/390/1440px; render no implica ejecutar todas las acciones de cada página.
- La corrección final del contraste de placeholders pasa de4.12:1 a5.13:1 sobre blanco. CompilaciónNode22 final aprobada; las mediciones históricas de carga mantienen sus fuentes originales.

## Límites de la aprobación

Pruebas de navegador en Chrome/Linux. No se certifica Safari/WebKit; el binario disponible no coincidía con la versión del controlador y no se forzó. El foco vuelve al disparador al cancelar; tras confirmar y reconstruirse una fila se observó BODY, sin certificar aún la continuidad completa del teclado. No equivale a accesibilidad global aprobada, revisión humana, F06-07 aceptada ni prueba de todos los controles condicionales.

Las vistas pobladas usan datos sintéticos identificados y servicios locales reales. CRM, Google/SMTP propios, modelos pagados y datos del cliente conservan sus validaciones externas. El resultado local no acredita el comportamiento del siguiente despliegue: se exige comprobar el SHA servido y el navegador remoto después de publicar.

Los fallos originales y sus correcciones se conservan. La comprobación adicional de movimiento reducido detectó interferencia de un segundo cliente CDP, reproducida de forma aislada; las comprobaciones focales sin ese segundo cliente validan la preferencia efectiva. No se atribuye ese fallo del ensayo a la interfaz.

Estado global:53/60alcances técnicos y25aceptaciones formales. Este cambio no aumenta esos contadores ni declara producción.

## Huellas de revisión

| Revisión | SHA256 del manifiesto |
|---|---|
| 379, estructura y navegación | ffdd693af82197e93998092a316392481c4e13b33c7f9f08d2cce370c1a32540 |
| 381, composición final y controles | b8ffec202cc76e5aeee5f9410eca023a8467e96beccc03f6fc76358f17cf88d9 |

La composición final comprende37fuentes revisadas. El inventario de carga contiene2089entradas; actualizarlo no crea una medición nueva. Los recibos y las sesiones permanecen privados.

## Comprobación posterior al despliegue

El SHA `aed5c3a7fc65c0af9f6ecc3315732e905774d03d` fue publicado y desplegado; su revisión servida coincide. Pasan seis controles remotos de versión/login/navegación/trabajo real,20rutas autenticadas después de resolver sus requests y el estado final móvil de importaciones. Chrome, cuentasSYN propias y sin inferencia pagada. Los cuatro controles de caché/aislamiento del mismo trabajo también pasan; [detalle del destino](VERCEL-ESTADO-2026-09-25.md). El smoke completo de ocho fases y producción siguen pendientes.
