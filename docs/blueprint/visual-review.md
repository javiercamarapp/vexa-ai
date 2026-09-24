# Revisión técnica de interfaz F06-07 — reserva 333

Propuesta de revisión independiente sobre datos **SYN locales**, Auth/PostgreSQL/Storage reales y Chromium. No es aprobación de producción ni juicio humano de usabilidad. Se conservaron las corridas rojas y se corrigieron únicamente controles cuyo fallo era demostrablemente de sincronización, selector o transporte CDP. El producto fue corregido por el autor principal en cinco archivos congelados.

## Composición y método

Base `3fe59d7b42f68ee874aebfa284bee7f7f973fb72`, 50 fuentes de propuestas de notificaciones, 16 de retención y dos consumidores combinados conservados en los manifiestos privados del examen. Se verificaron los SHA antes de materializar. La unión de consumidores conserva `history` y `notifications` y ambos contratos RPC; no sustituye una revisión de seguridad SQL. La última composición incorpora cinco archivos de reparación congelados. Cuatro se integran en el producto publicado; el archivo de Push permanece en la propuesta dependiente de F06-09.

Se reutilizan las evidencias 316/320 de fuentes inalteradas, con sus hashes. Las pruebas nuevas usan 390×844 y 1440×900, movimiento reducido, DOM real, navegación por teclado y axe. Las demoras y errores se provocan reteniendo o abortando solicitudes reales; las respuestas de negocio no se fabrican. El alcance económico procede de snapshots reales de la fixture: importes conocidos y subtotal de 300.00 USD, importes desconocidos `null`, identificador y hash de alcance conservados.

## Cobertura acumulada

“Observado” indica un estado ejercitado, no una aprobación universal. “No aplica” identifica un estado que el contrato de esa vista no representa.

| Vista | Estados observados o reutilizados | Acciones y límites |
|---|---|---|
| Resumen | Ready, loading/error y empty reutilizados 320; partial y corte histórico 333 | Importe desconocido separado del subtotal conocido; scope estable. |
| Problemas | Ready, loading, error, empty, partial y corte histórico | Catálogo actual distinguido del corte financiero; filtros y CSV del alcance comprobados. |
| Detalle de problema | Ready, loading, error, partial y corte histórico | Componente → evento → evidencia financiero. Empty no aplica a un identificador válido: snapshot/entidad inexistente es rechazo/404. |
| Cliente | Ready, loading, error, partial y corte histórico | Binding real de cliente; empty no aplica al contrato de detalle identificado. |
| Recomendaciones | Ready, loading, error, empty y revisión histórica | Edición por formulario real en ambos tamaños. No posee un estado financiero partial independiente. |
| Explorador | Ready, loading, error, empty, partial y corte histórico | Consulta POST real, unknown≠zero, subtotal y referencia financiera. Último focal valida ajuste de línea y enlace íntegro. |
| Intervenciones | Ready, loading, error, empty y medición partial | Guardar plan, aprobar, iniciar, terminar y medir: POST reales 200. Medición desconocida mantiene delta desconocido y cierre deshabilitado. Stale no es un enum propio; se conserva historial. |
| Brief semanal | Ready, loading, error, empty, partial y corte histórico | Descargas JSON/HTML reales: documento, id y hash iguales al API. |
| Auth | Login ready en ambos tamaños; logout real; error HTML de acceso | Callback inválido devuelve JSON 401 por contrato, no una página HTML. OAuth externo no configurado ni ejercitado. Partial/stale/empty no son estados de Auth. |
| Notificaciones | Loading/error/empty reutilizados 316; ready, marcar leída y filtro 333 | POST 200 y estado posterior. No existe enum financiero partial/stale. |
| Preferencias | Ready, loading/error, guardar y persistir tras recarga | Confirmado en ambos tamaños. Defaults no equivalen a lista vacía; no se inventa estado partial. |
| Entrega | Ready, loading/error y guardar política | POST 200 ambos tamaños; sin envíos reales. |
| Push | Loading, error, retry, configuración disponible/no disponible | Revocación real de fixture y fallo de refresco no anuncian éxito falso. Registro seguido de fallo de refresco revisado estáticamente, no mediante permiso push real. |
| Histórico | Loading/error/retry principal y detalle, autorizar/cancelar | Desktop completo; móvil retry y cancelación pasan antes de timeout posterior del wrapper. No se atribuye PASS a esa corrida completa. Pipeline delegado reutiliza revisión 331, no se vuelve a inferir. |
| Análisis, agrupación y economía | Ready, loading/error, formularios de presupuesto y datos parciales | Guardado persistido de presupuesto ambos tamaños; no hay inferencia ni gasto. Controladores nuevos de propuesta 332 no incluidos. |

## Hallazgos y correcciones

1. Push mostraba navegador no compatible durante una lectura pendiente y omitía loading: se separó detección de capacidad, estado de lectura y error. Se probaron retención, aborto, retry y revocación con refresco fallido en ambos tamaños.
2. Histórico omitía loading y exponía `Failed to fetch`: se añadieron estados accesibles y error controlado al listado y detalle.
3. Economía usaba `aria-label` en un div sin rol: el grupo ahora tiene `role=group`.
4. El subtotal parcial del explorador estaba fuera de `dd` en dos ramas: ahora conserva la estructura de lista de definiciones.
5. Una referencia larga en la respuesta del explorador ampliaba el ancho móvil de 390 a 687 px: la propuesta final aplica ajuste de línea al elemento de referencia.

Los hallazgos originales, DOM, solicitudes, capturas y SHA se conservan. No se transforma el resultado agregado de corridas interrumpidas o controles fallidos en un PASS total.

## Accesibilidad y observación visual

Axe no resolvía automáticamente el contraste de las opciones de un select múltiple nativo. Se midieron los colores CSS efectivos: texto RGB(25,43,39), fondo RGB(255,254,250), contraste 14.6938:1; se conserva el detalle de opciones y herencia de fondo. Esto resuelve ese caso concreto, no todos los incompletos por decreto. El incompleto de aria en economía requirió una corrección real de rol.

La navegación Tab/Shift+Tab conserva foco visible; algunos textarea largos quedan parcialmente fuera tras auto-scroll, pero el control intersecta la ventana y se puede desplazar. Movimiento reducido produjo cero animaciones/transiciones calculadas en las capturas y se mantuvo durante operaciones reales. No se probó un lector de pantalla ni otros motores de navegador.

La inspección visual AI de capturas comprueba estructura, lectura, límites de importe y el defecto de referencia larga. **La revisión humana externa de usabilidad y estética sigue pendiente**. Esta revisión funcional no examina ni acepta el dominio SQL09/299, ni autoriza producción, envíos o publicación.

## Evidencias y resultados

El manifiesto privado final SHA-256 `1cd537cdc6ad70269da5ae82c64325bf1c9d8c80784d940698ed093171847139` enumera controles, recibos originales, capturas, comandos, fuentes y limpieza. Las corridas originales conservan fallos de selectores, tiempos y CDP: exportación por `saveAs`, lectura JSON CDP de POST histórico, espera genérica de networkidle y selectores de formularios. Sus verificaciones pertinentes se recuperaron con descargas reales, GET autenticado y espera del estado DOM específico. No se deshabilitaron aserciones de negocio.

La corrida micro de histórico móvil conserva un timeout de `networkidle` posterior a comprobar detalle recuperado y cancelación 200. La corrida completa sigue registrada como fallida; sólo esas aserciones previas tienen evidencia positiva. Todas las pilas se limitan a recursos locales con UUID propio y sus recibos de limpieza.
