# Acceso, administración y correos — 30 de septiembre de 2026

El producto `c7a30ac93834ff2f2167a143752b11a759979086` está publicado en GitHub y desplegado en [VEXA AI](https://vexa-ai.vercel.app). Se comprobó el estado READY y el mismo SHA servido. El retorno del enlace original de Supabase ahora llega a `/auth/email/complete`; la configuración anterior de localhost quedó corregida.

## Alcance entregado

- Recuperación de invitaciones ante espera agotada, sin repetir automáticamente la aceptación.
- Administración de plataforma en `/platform`: organizaciones, miembros e historial. Permiso persistente y revocable ligado a identidad y sesión verificadas; no concede acceso global a los datos de negocio.
- Cancelar Google devuelve al login con un mensaje accionable. El proveedor Google real sigue deshabilitado hasta configurar sus credenciales propias.
- Migración `platform_administration` aplicada mediante MCP; versión remota `20260930230645`. RLS forzada y ausencia de DML directo para usuarios autenticados comprobadas. El administrador solicitado tiene un permiso activo y auditado.

## Verificación

Revisión independiente 404 aprobada para 17 fuentes: 53 controles SQL del cambio, 4 de baseline y 3 de callback. Composición con 34 pruebas Auth HTTP, lint y compilación Node 22 aprobados. La integración local concilia 16 comprobaciones reales; conserva las corridas inicialmente fallidas por expectativas del harness y configuración local, con sus correcciones focales. No representa una corrida íntegra sin fallos.

Prueba remota sobre el SHA publicado: 6 comprobaciones aprobadas. Enlace original → sesión y entrada a plataforma; documento privado; lectura del equipo sintético sin autoalteración de membresía; interfaz móvil e historial; revocación del permiso durante una sesión existente; cierre de sesión hacia login. Sin correo externo ni escrituras sobre datos de clientes. El permiso temporal de prueba fue revocado y las sesiones de la identidad sintética quedaron cerradas. Falta confirmación del usuario sobre su propia recepción y entrada desde el buzón.

## Correos con membrete

Las 13 plantillas Auth existentes comparten cabecera VEXA, paleta verde/blanco/negro, tipografía, asunto, preencabezado, contenido y pie de seguridad. Comprenden 6 mensajes de autenticación y 7 avisos de cambios de seguridad. El nombre tipográfico es provisional; falta el logo final.

Antes del ajuste de centrado se comprobaron 52 presentaciones en Chromium y WebKit: 13 plantillas por 2 anchos (320 y 800 px) y 2 motores, sin desbordamiento horizontal y con acciones de al menos 44 px. Se inspeccionaron además capturas representativas. Tras la petición de centrar los botones verdes, se modificó únicamente la alineación de la tabla CTA en el generador y sus cinco plantillas con botón. Pasaron los 15 tests existentes en Node 26.7.0 y 20 comprobaciones focales nuevas: los cinco botones centrados con desviación máxima de 1 px en los mismos dos tamaños y motores. Las otras ocho plantillas permanecen intactas. Esto no acredita renderizado en Gmail/Outlook/Apple Mail ni entrega real.

El patch disponible contiene únicamente 13 asuntos, 13 HTML y 7 ajustes de avisos. Las plantillas remotas no están aplicadas ni verificadas: falta acceso legítimo a Auth Management/dashboard. SMTP propio, remitente/dominio y Reply-To atendido siguen pendientes. La guía [de configuración](../../support/F08-auth-brand/README.md) conserva el procedimiento. Los correos de eventos de negocio siguen en F06-10 y no se dan por cerrados con estas plantillas Auth.

## Trazabilidad y límites

| Evidencia | SHA256 |
| --- | --- |
| Revisión independiente | `e71d63bf59ea1e68fe0036fbf7aca938860a834428bf0cf12059c622b0f541e1` |
| Composición | `6dab7305b02b5a693659f643ac872fbe32934def0876854eba8898f568d1199c` |
| Integración reconciliada | `21a90f5226a1f1fa675e8fb6100f4fb9d23c0df794cae0d4957ced3e8617c341` |
| Smoke remoto | `e9502078817e2f7ed1e3cbc62c0ee307a3e2788f4de7121fe0dfb9e502ef4233` |
| Despliegue | `af419bfb9c1ff8058d01655f5a91a838015a74bd6b5206593c2148452916dc22` |
| Presentación de correos | `cf22f1be40440090bbdb481812ba404a8eed535178b122287b146cd9d8e30112` |
| Centrado focal de correos | `ed4c34e1de4af2f264ebe325d43586755907f7d4bc52bb7ef282ea85639f57f9` |
| Fuentes del centrado | `4aeb8ddbc901a1df8750677c25cc20bc831a84949ea58e8338254b8cedea9ef9` |

Tres commits coherentes preservan autoría: `26335b8`, `4db10fe` y `c7a30ac`. Publisher autorizado verificó el SHA remoto y la asociación de autor/committer. Actions permanece desactivado y el proyecto Vercel sin integración Git; el despliegue fue manual y autorizado. Estos controles no prometen ausencia de cualquier costo del alojamiento.

Se mantienen **54/60 técnicas, 25 aceptaciones formales y producción pendiente**. Restan F06-09, F06-10, F06-11, F06-12, F06-07 y F07-01. Este incremento no sustituye la auditoría final de 20 rubros, las cuentas reales, la operación ni el piloto. Al cierre Auth se habían recogido los agentes 403–405. El usuario autorizó después una tanda acotada de tres agentes F06 (406–408), conservando el acumulado y sin gasto externo: presentación de correo, interacción de plataforma y preparación de push. No se atribuyen a esa tanda resultados aún pendientes.
