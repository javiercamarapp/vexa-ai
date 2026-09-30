# Administración de plataforma

El permiso de plataforma administra organizaciones y sus equipos desde `/platform`. Es independiente de `owner`: no agrega membresías ni permite leer datos de negocio de otros equipos. Cada solicitud comprueba un grant activo por UUID Auth, correo confirmado, cuenta no eliminada/bloqueada y sesión Auth existente y vigente. La metadata del usuario y su correo no conceden el permiso.

Aplicar primero `20260930224057_platform_administration.sql`, después desplegar. Requiere identidad `0001` y equipo `0038`. Las rutas de correo y OAuth consultan el permiso; sin la migración devuelven indisponibilidad, no éxito. `/platform` refresca la sesión sin exigir membresía; el workspace conserva sus controles originales. El acceso por correo muestra el enlace a plataforma; OAuth sin otro destino lleva directamente a plataforma cuando el grant está vigente.

El grant inicial y su revocación sólo los realiza el operador autorizado de base de datos con el UUID Auth comprobado y evidencia privada de autorización. La aplicación no concede ni edita grants, y no incluye ninguna cuenta real en sus fuentes. Para revocar, el operador marca `active=false` e incrementa `version`; la próxima solicitud queda denegada. Las operaciones en curso mantienen un bloqueo de lectura del grant hasta completar su transacción.

Crear una organización requiere nombre, correo del responsable, confirmación y requestId de intento. Se resuelve una única cuenta Auth existente, confirmada y no bloqueada. El responsable debe ser distinto del administrador; recibe owner en esa nueva organización. El mismo requestId y datos devuelve el resultado original sin duplicar; cambiar los datos con ese requestId devuelve conflicto. No se crea una cuenta Auth ni se envía correo durante esta operación.

La administración de equipos reutiliza invitaciones, roles, revocación y protección del último owner. El endpoint de plataforma exige su grant aunque el solicitante también sea owner. Desde plataforma se prohíbe modificar la propia membresía o invitarse; la administración normal de su propia organización continúa por Equipo. Las invitaciones usan únicamente la configuración existente `VEXA_TEAM_AUTH_ADMIN_KEY` y `VEXA_TEAM_AUTH_URL`; envío ausente o incierto sigue siendo pendiente y no se declara entregado.

Las mutaciones de plataforma se registran en `vexa_platform.audit` en la misma transacción. Los cambios de equipo conservan además `team_audit`. El historial de plataforma muestra actor, operación, destino y fecha con paginación. Tablas y funciones internas no tienen acceso público; sólo las RPC acotadas están disponibles a sesiones autenticadas y vuelven a comprobar autoridad.

Esta implementación no valida Google, correo real ni URLs remotas, no aprovisiona cuentas automáticamente al login, y no acredita producción. Pruebas de migración, revocación y recorridos deben completarse antes de conceder permisos reales.
