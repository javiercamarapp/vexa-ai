# F06-07 — Interfaz integrada y accesibilidad comprobadas

**59/60 técnicas; 28 aceptadas formalmente. Producción pendiente.** El cambio de producto es el contorno de foco verde de campos de fecha (`6d505f7`); la composición vigente conserva estructura Atiende y paleta verde, blanco y negro. La aceptación formal requiere revisión visual humana y la cadena de dependencias de F06-12: no se altera el grafo para simularlas.

El ensayo integrado run9 completó instalación, lint y compilación, 68/68 revisiones de pantalla y ocho acciones con persistencia. Chromium 149 y WebKit 26.5, Node 22.23.2, resoluciones 390×844 y 1440×900 y movimiento reducido. Se comprobaron las ocho vistas principales, bandeja, preferencias, dispositivos, entrega, equipo y pantallas de acceso. No se atribuye este alcance a todas las ramas o botones de las 32 rutas inventariadas.

Cada motor produjo un aviso mediante evento/cola/consumidor reales sobre datos SYN autorizados, lo leyó por UI y comprobó API, contador, recarga y aislamiento de otro tenant. También verificó preferencias y generación de brief. No se inventó un aviso insertándolo directamente en la bandeja. Los estados de carga/error/vacío y recuperación se ligaron al ledger de 66 celdas:33 observaciones heredadas con hashes,13 no aplicables y20 ejecutadas en la composición actual.

Teclado nativo, foco visible, etiquetas, desbordamiento y errores JS/RSC examinados; cero fallos de scan. Se conservan los resultados originales de axe. Los incomplete de contraste se resuelven por elemento con geometría y colores medidos, cotas conservadoras y umbrales 4,5:1 o 3:1 exclusivamente para texto grande; los casos desconocidos fallan. La revisión independiente 433 coteja los artefactos, las fuentes y los recibos, sin convertir una prueba automática en juicio humano.

| Recibo | Resultado | SHA256 |
| --- | --- | --- |
| Informe integrado run9 |68/68 y8acciones; exit0 |`28da093c29dc8a133951efd40e480df87873b0cfe00cb88e2c7be9b0306f6fb9`|
| TAP run9 |243,9segundos; cero cancelaciones/omitidas |`1ecec4bf01a44b3c3f93e180483bb24cace5825fa1d4d0ff25ce1bac8f0ea643`|
| Producto CSS |Candidato Git limpio e inalterado |`d0c43c455993ab5635821fcea0c633247000742c84a679fbc75f48f88d66f410`|

Los cinco recursos Docker y los directorios temporales fueron retirados; controles y candidato conservan sus hashes. Los ensayos rojos anteriores se preservan: no se reclasifican como verdes ni se ocultan con reintentos. Las correcciones del control y sus calibraciones están en [F06-07-gate](correcciones/F06-07-gate.md).

## Límites y continuación

No acredita Safari físico, lector de pantalla, juicio visual humano, entrega a proveedores/dispositivos reales ni aprobación de producción. El contraste analítico del título de login se verificó a 1440 px; no se extiende a tamaños de texto fuera del contrato. Las rutas suplementarias conservan su evidencia anterior identificada; no son una promesa de cobertura universal.

Resta F07-01, conciliación de inventario/carga y entradas formales, comprobaciones integradas del release y auditoría de20 rubros. Después seguirán cuentas, configuración de proveedores y validación con histórico autorizado, gold humano y responsables del piloto. El resultado automático no certifica calidad semántica con datos reales.

Dictamen independiente 433: `b4cfab420664f729f19b180e858a229eb7e87bb7d38017b0d82336c31e4ab4e0`. Comprobador: 2.032 objetivos de teclado, 132 incomplete originales cotejados con sus 132 resoluciones explícitas y 20 escenarios obligatorios. Publicación y verificación remota pendientes al redactar este recibo.
