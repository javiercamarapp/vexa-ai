# F01-03 — correcciones obligatorias antes de nueva congelación

Recuperación de sesión: 2026-09-19. El usuario pidió recuperar y continuar la construcción existente. Estado al recuperar: baseline dc59d31187df0997c26d433e47b315aaaa971c80; 8/60 tareas aceptadas. F01-03 NO tiene candidato ni gate aceptado.

## Cierre de revisión del examen — 19-sep, 14:05 local
- Suite final tras corrección diferida:73/73controles/mutantes y168/168contra laboratorio,0fallos/0skips. Baseline canónico continúa rojo IMPLEMENTATION_MISSING. No se presenta laboratorio como candidato aceptado.
- Revisor anterior reprodujo67controles SQL y detectó falso rechazo de FK DEFERRABLE INITIALLY DEFERRED. Principal reprodujo00000 frente a23503 esperado; el probe ahora fuerza SET CONSTRAINTS ALL IMMEDIATE antes de rollback, sin desactivar RI. Revisor independiente reprodujo19comprobaciones: FK inmediata/diferida, ausente/escalar, guard falso23503, restauración de triggers/datos/modo y permisos authenticated. Correctivo aprobado, fuentes preservadas por SHA256.
- Se adopta el examen revisado en control-plane para congelarlo antes de preparar candidato oficial. No hay aceptación automática ni cambio manual de estados. Historial anterior conservado abajo.

## Recuperación posterior — 19-sep, corte anterior: examen aún NO congelado
- Se reprodujeron72controles/mutantes SQL/Auth/Storage/RPC:72pass,0fail,0skips. Se añadieron y ejercitaron escrituras Storage ajenas, autorreactivación prohibida y login real nuevo del mismo usuario revocado. Mutaciones de POSTupsert/PUT requieren también INSERT permisivo para representar una vulnerabilidad efectiva; sin eso la API aún rechaza por RLS y no se mata un mutante real. No se eliminó ningún negativo.
- Examen contra schema propuesto:162/168pass;5fallos específicos más envolvente. Storage/retrieval/revocación vieja+nueva pasan. FallosFK: guards de dominio/parent inmutable se ejecutan antes de RI y devuelven23514 o23503 sin nombre de constraint. No es evidencia de fuga; tampoco permite aceptar una FK por un guard que la enmascara.
- Corrección propuesta del EXAMEN, pendiente revisión independiente: probar FK física como administrador desechable dentro de la transacción siempre-revertida del probe, con DISABLE TRIGGER USER sólo en esa operación. Triggers internos RI permanecen activos; RLS/roles/tenant/immutabilidad/servicios se prueban por separado sin desactivar triggers. No aplicar esta técnica al producto, DB compartida ni operaciones de autorización.
- Nueva regresión independiente: trigger inmutable23514 y guard que simula23503. Con FK presente pasa; retirarFK debe fallar aunque el guard siga rechazando; comparar catálogo de triggers antes/después demuestra restauración por rollback. Reproducción pequeña rojo/verde realizada; suite completa73y nuevo candidato se repiten antes de solicitar congelación. Propuesta no aceptada por haber agregado el control.

## Rechazo preservado
Revisión independiente `.runtime/auto-1789811719497179000-1789812168471004000-review.json`, approved=false. La propuesta rechazada se conserva en `.runtime/auto-1789811719497179000-1789811719591932000-gate-worktree/tests/acceptance/` del repositorio canónico `~/vexa`. Se puede leer/copiar su soporte como punto de partida, no tratarlo como examen aprobado. No publicar logs ni recibos privados.

### P1 — cobertura funcional de TODAS las tablas protegidas
SELECT sólo cubría connections/conversations; INSERT/UPDATE/DELETE sólo connections. Inspeccionar relrowsecurity no detecta políticas USING(true)/WITH CHECK(true).

- Preparar matriz explícita de tablas, fixtures A/B válidas y operaciones permitidas por contrato. Cubrir cada tabla tenant-aware, incluyendo jobs, órdenes, dinero, evidencias y auditoría.
- Probar lectura y escrituras A→B sin filtros de aplicación, anon, sin membership, revocación y tenant swap. Añadir positivos autorizados por operación; no exigir escrituras de usuario donde el contrato las reserva al backend.
- Cada rechazo debe distinguir SQLSTATE de autorización/FK de sintaxis, schema ausente, caída del servicio o fixture inválida. Verificar ausencia de efectos persistidos.
- Un mutante con política permisiva en una tabla antes no ejercitada debe fallar por una aserción funcional concreta, no por inspección cosmética.

### P2 — presencia de relaciones obligatorias
La consulta anterior sólo inspeccionaba FKs existentes; borrarlas hacía desaparecer su examen.

- Enumerar las relaciones contractuales y columnas referenciadas desde construccion/03-CONTRATOS.md y docs/blueprint/01-CONTRATOS-Y-DATOS.md. Exigir su existencia y correspondencia tenant-aware.
- Probar positivo A→A y referencia A→B rechazada con SQLSTATE23503, incluyendo order_lines→orders y reversals→economic_events, no sólo conversations→connections.
- Quitar una FK contractual debe producir fallo específico. No permitir que otra restricción o RLS oculte la ausencia de esa FK.

### P2 — demostrar los oráculos, no sólo archivos ausentes
El rojo anterior IMPLEMENTATION_MISSING acredita ausencia, no sensibilidad de las pruebas a defectos.

- Ejecutar controles positivos y mutantes específicos sobre PostgreSQL real en entorno sintético propio y reproducible. Pueden existir fixtures de prueba de referencia dentro del soporte del examen; NO son código de producto, no se adoptan como implementación ni acreditan F01-03.
- Registrar comandos, salida, positivos y aserción que elimina cada mutante. Ningún error de setup cuenta como mutante eliminado.
- No congelar si sólo se reprodujo IMPLEMENTATION_MISSING. Mantener controles reales de Storage privado, firma autorizada y retrieval sin fuga SOLO_B_9F; ni un JSON passed, stub HTTP o motor SQL simulado acreditan esos servicios.

## Entorno y ejecutabilidad del examen
Docker estaba apagado al recuperar; el operador lo arrancó y comprobó los contenedores VEXA locales existentes. El stack compartido ya contiene identidad F01-02: NO está vacío ni lleva la etiqueta ficticia vexa.f01-03.exam=disposable que exigía la propuesta anterior.

- Corregir el diseño de setup: el comando de gate debe ser ejecutable por el supervisor y por accept en materialización limpia, sin variables manuales secretas ausentes. Debe poder repetirse en regresiones sin resetear la DB compartida ni tocar las migraciones ya aplicadas.
- Leer el patrón vigente tests/acceptance/support/F01-02/harness.mjs. Sólo credenciales sintéticas VEXA dentro del proceso tras comprobar identidad; jamás imprimirlas ni pasarlas al modelo. No reutilizar secretos de otros proyectos.
- Se dispone de PostgreSQL17 local en /opt/homebrew/opt/postgresql@17/bin para ensayos SQL desechables propios. Verificar extensiones necesarias antes de decidir el harness. Puerto publicado sólo dentro del rango VEXA56321..56329; un socket Unix propio evita ocupar puertos. No tocar otras bases/servicios.
- No detener, resetear ni relabelar el stack existente para satisfacer un preflight. Un nuevo entorno debe tener recursos propios, cleanup limitado a ellos y launcher reproducible. Si el sandbox impide una operación, reportar el comando preciso para ejecución por el operador; no declarar integración probada.
- Las firmas RPC, campos y permisos deben derivarse de contratos, y toda decisión de binding debe quedar explícita para revisión externa. No cambiar contratos para hacer verde el test.

## Secuencia autorizada
Nueva autoría aislada → positivos/mutantes y baseline → revisión independiente → congelación → candidato allowlisted → verify/revisión/regresiones → accept con materialización limpia. Conservar rechazo y consumo anterior. No modificar estados a mano ni aceptar la tarea por documentación.
