# Aprobación de registros y fuentes económicas

## Defecto reproducido y corrección

Una aprobación podía permanecer marcada al cambiar el importe o la fuente de un registro. En el ensayo local SYN, aprobar100 y después cambiar a900 y otra fuente permitió POST200 y persistencia de900 sin renovar la aprobación. Cambiar el nombre o la declaración de completitud de una fuente presentaba el mismo problema. No hubo pagos ni cambios en cuentas reales.

La corrección vincula la aprobación al contenido actual y a las versiones de fuente/registro. Editar un campo revoca la aprobación, incluso si después se restaura el valor anterior. Una actualización de versión también la invalida. El botón y el envío comprueban esa vigencia; aprobar de nuevo permite guardar los valores actuales. No cambia contratos, fórmulas, unidades monetarias ni SQL.

## Evidencia del autor397

- Rojo original: dos envíos reales con Auth/PostgreSQL locales y filas persistidas, conservados con sus capturas.
- Dos controles corregidos de POST y persistencia pasan: registro y fuente.
- Tres grupos adicionales pasan: edición/restauración y versiones;12campos de soporte/escenario modelado; fuente activa y ventana. Los cambios de supuestos se comprobaron sin enviar registros adicionales.
- Lint/build con Node22.23.2; versión y ejecutable registrados. Se conserva un fallo inicial de tipos y otro de sincronización del control: esperar ausencia de red no demostraba haber renderizado la nueva versión. El control corregido espera el GET y el estado visible correspondiente.
- Recursos propios eliminados. Manifiesto64artefactos: `8dab4e5d4054057f674179bbb4db5b309ea92783ecfd084193be5dece4dc9d2a`.

Única fuente de producto: `apps/web/src/components/economic-panel.tsx`, SHA256 `efd54805af59e4b31a631effe809135f842f062795ac1dc80a87e7f7f2570c0f`.

## Revisión y publicación

Revisión independiente398: APPROVED_SCOPED. Tres grupos con Auth/PostgreSQL reales, lint/buildNode22.23.2 y cero erroresJavaScript. Un refresh idéntico conserva la aprobación; cambios de versión la invalidan. Un conflicto real409 mantiene la revisión concurrente; actualizar y confirmar permite POST200 con revisión3 y escenario de500unidades menoresUSD. La fuente también exige confirmar su versión actual antes de guardar. Métricas observadas intactas y total combinado desconocido. Se conservaron un fallo de sincronización del control y un arranque fallido por directorio existente, anterior al setup. Recursos eliminados.

Manifiesto independiente36artefactos: `a5f25d2c112295df774808c38c2a38c720b7232dbedad39a35eb803fd3c84d6a`. Ambos manifiestos y el archivo integrado se verificaron por hash. El inventario de2089fuentes está reconciliado; no se atribuye un benchmark nuevo.

La publicación remota y el despliegue se registrarán después de comprobarlos.

## Control independiente de navegación móvil

En el despliegue previo5c9f84d, activar por teclado el enlace Equipo dentro del diálogo móvil cierra el menú y devuelve el foco al botón visible de apertura. El siguiente Tab llega a Notificaciones en Chromium y Option+Tab en WebKit, a390×844. No hay foco retenido en el diálogo oculto, errores JavaScript ni mutaciones remotas. Sesiones propias cerradas. Se conserva el primer fallo del selector de prueba, que esperaba un título distinto del h1 real.

Manifiesto9artefactos: `d6bf2dc2cc594a662f885382de6062d4fbe7e82bb975c8de75ebed2fb63905cf`. La prueba usa foco dirigido antes de activar los enlaces; no acredita recorrer íntegramente el menú mediante Tab ni uso de lector de pantalla.

53/60técnicas,25formales. Esta corrección y estos controles no cierran F06-07 global ni acreditan producción.
