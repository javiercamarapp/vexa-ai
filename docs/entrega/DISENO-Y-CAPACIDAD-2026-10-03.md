# Diseño y comparación de persistencia — 3 de octubre de 2026

El acceso usa la composición de referencia de Likida: columna de 392 px, Fraunces para el título, Instrument Sans para los controles, marca sin recuadro y botones del ancho del campo. El panel incorpora Inter Tight en títulos y cifras, superficies y bordes neutros de las referencias, tarjetas financieras compactas y botones consistentes. La imagen de VEXA se conserva. La referencia de Atiende se consultó en su código; su preview exige autenticación y no se presenta como captura visual verificada.

Una primera visita sin sesión abre el login normal. Una identidad sin organización autorizada, una membresía revocada o un espacio no autorizado conservan el rechazo de acceso. Los errores del servicio no se convierten en ausencia de permisos. La navegación directa a un único espacio y la guía para espacios vacíos conservan su comportamiento.

Comprobaciones locales: 37 casos HTTP de autenticación y middleware, incluidos primera visita, identidad inválida y membresía revocada; 11 casos de entrada con el resolvedor real de sesión y puertos de identidad sintéticos; 30 casos de componentes React en navegador para acceso, menú, móvil, teclado, tema, gráficos y consultas. Lint, tipos y compilación de producción pasaron. No acreditan una sesión personal del usuario, una revisión visual humana ni todos los recorridos remotos. La evaluación visual utilizó capturas actuales a 1440 y 390 px y la referencia pública de Likida.

## Comparación sintética

El [ensayo 37128223493](https://github.com/javiercamarapp/vexa-ai/actions/runs/37128223493) ejecutó la fuente `0de11dc21d9467f0c344c4f0ce3f8d974c9d4082`, antes de este ajuste visual. Corrigió la omisión del lector en el paquete de ensayo; el código de persistencia del producto no se modificó.

| Variante | Ventana 1 · 1.000 filas | Ventana 2 · 1.000 filas | Media |
|---|---:|---:|---:|
| Actual | 20,776 s | 20,239 s | 20,508 s |
| Experimental | 19,255 s | 18,895 s | 19,075 s |

Las cuatro ventanas registraron 980 aceptadas, 10 rechazos esperados, 10 duplicadas y cero pendientes. La media experimental fue aproximadamente un 7 % menor. Se ejecutaron calentamientos y orden ABBA, con muestras del host válidas. Cada bloque de 100 filas pasó de 2.195 a 1.901 consultas, incluyendo la consulta del plazo.

Las dos variantes pasaron ocho controles acotados en PostgreSQL/Auth/Storage reales: revocación del consumidor, rollback intermedio y recuperación, lectura del histórico largo con microsegundos, replay, aislamiento de otro tenant, revisión de fuente y borrado sin resurrección. Los cinco recursos propios y los temporales se retiraron; Actions volvió a desactivarse.

Son dos observaciones por variante, con una base que crece entre espacios de datos. No prueban una mejora estadística, capacidad comercial ni 50K/150K. La optimización sigue experimental y no está adoptada ni desplegada. No se reejecutó F07-01.

**Estado: 59/60 implementaciones, 28/60 aceptaciones formales; producción pendiente.** Permanecen capacidad a mayor escala, recuperación gestionada, revisión global y las cuentas, datos y validaciones externas registradas en el backlog.
