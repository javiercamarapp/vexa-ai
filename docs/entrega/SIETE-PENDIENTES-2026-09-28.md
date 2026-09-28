# Las siete fichas que faltan

Corte de código público: `d5cb1ea75c6859edf8be0365f9fcc81cfd39fd1e`; producto desplegado y smoke aprobado: `b9ed3db5ef4df825c27ed208722ad2faad4ee9c3`. El total sigue en **53/60 técnicas y 25 aceptadas formalmente**. Esta lista distingue trabajo de ingeniería, revisión interrumpida y evidencia que sólo pueden aportar personas externas.

| Ficha | Lo disponible | Lo que impide cerrarla |
|---|---|---|
| F06-07, interfaz y accesibilidad | Ocho vistas, navegación, estados y correcciones revisadas; checks adicionales WebKit/axe sobre el producto público y corrección del selector con revisión independiente. | Completar cobertura de estados y contraste, clasificar el comportamiento de precarga de WebKit en la auditoría global, incluir las pantallas de entrega cuando su ámbito esté habilitado y revisión visual humana. No basta una captura ni cero avisos de axe. |
| F06-09, entrega durable | Centro de lectura publicado en F06-08. Hay evidencia funcional histórica de una propuesta de entrega, que no está aceptada. | Revisión automática interrumpida, sin dictamen independiente final; integración y regresiones pendientes. No se puede dar por entregado el outbox ni sustituir la revisión con una clave API. |
| F06-10, correo de producto | Propuesta local y ensayo histórico de correo local; separados de los correos de autenticación ya integrados. | Depende del ámbito de entrega bloqueado; faltan revisión e integración aceptadas. Después, dominio/remitente propios y verificación real de entrega/recibos. |
| F06-11, Web Push | Propuesta local; no es una función aceptada del producto público. | Depende del ámbito bloqueado; revisión, integración y recorrido de consentimiento/dispositivo/entrega real pendientes. Una clave VAPID no acredita ese recorrido. |
| F06-12, emisores y recorrido completo | Propuestas de conexión de eventos de negocio a los canales. | Integración aceptada de F06-09/10/11, atomicidad, deduplicación y recorrido completo en dos organizaciones. No hay entrega automática demostrada por el inbox de lectura. |
| F07-01, seguridad global | Controles locales y smoke remoto de aislamiento, IDs conocidos y revocación; permisos restringidos del destino observados. | Cobertura global del producto completo, incluido el ámbito de entrega que no se ha podido revisar. Un aviso genérico de plataforma no es por sí mismo un defecto reproducido del producto. |
| F07-05, evaluación humana del piloto | Herramienta de evaluación con holdout, denominadores, custodia, controles de filtración y protocolo; plantilla de resultados sin métricas inventadas. | Consentimientos, gold de humanos, sponsor, participantes y medición real de comprensión/insight/acción/disposición a pagar. Un agente no puede fabricar esas observaciones. |

Las fichas bloqueadas conservan sus originales y recibos; no se reenvía el examen interrumpido por otra vía. El recibo indica «This content was flagged for possible cybersecurity risk» y no identifica una operación ni una corrección. Esto permite describir el bloqueo, pero no afirmar que se haya encontrado o corregido una vulnerabilidad concreta.

## Checks del entorno en este corte

- `python3 scripts/guide.py audit`: 60 fichas, cero errores estructurales y 51 gates disponibles. Faltan nueve entradas formales: estas siete más F08-03/05, cuyos entregables técnicos ya están revisados y conservan validación humana. Disponibilidad de un gate no significa que pase.
- Supabase: tres tablas internas con RLS forzada y sin permisos SELECT/INSERT para `authenticated`, ni SELECT para `anon`. El aviso «RLS Enabled No Policy» no indica exposición de esas tablas. No se añadieron permisos para silenciarlo.
- Tres funciones de autorización/gestión tienen `SECURITY DEFINER`, `search_path` vacío y ejecución denegada a `anon`; `authenticated` puede ejecutarlas por diseño. Las fuentes contienen comprobaciones de identidad/organización/rol. Este cotejo de configuración no sustituye una prueba completa de todas las ramas. [Descripción del aviso](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- La protección de contraseñas filtradas figura desactivada en Supabase. Es un aviso de configuración, separado de la revisión F06-09 y de los métodos Google/magic link aún sin conectar. [Configuración del proveedor](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- La consulta MCP de errores runtime de Vercel devolvió `403 Forbidden`; no aporta un resultado favorable ni se interpreta como ausencia de errores.

El smoke remoto completo ya aprobado conserva su [informe y alcance](SMOKE-REMOTO-2026-09-28.md). Los [aportes de cuentas y datos](PENDIENTES-PARA-CONECTAR.md) son distintos de estas revisiones técnicas. Ninguno de los checks anteriores certifica producción ni modifica el contador.

[Checks UI, corrección y límites](CHECKS-UI-2026-09-28.md) · [Ciclo de agentes y evidencia reconciliada](CICLO-AGENTES-2026-09-28.md).
