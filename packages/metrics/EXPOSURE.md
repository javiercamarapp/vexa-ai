# Exposición por unión de identidades confirmadas

La consulta de `/overview` usa el ledger económico actual y problemas con extracción y evidencia autorizadas. No publica un snapshot, calcula FX ni suma exposición, reembolsos, reemplazos, soporte y escenarios como pérdida total.

El propietario puede registrar cuatro decisiones con evidencia operacional y una versión esperada:

- `link`: vincula un problema actual con una fila real del ledger (orden, reembolso, reversión, reemplazo o soporte). `active:false` registra una retirada; no borra historia.
- `orderAlias`: confirma que dos órdenes del ledger representan la misma orden. Exige misma moneda, exponente, base, importe, estado y fecha efectiva. Identificadores de CRM o UUID de tablas antiguas no prueban equivalencia. Un ciclo se rechaza. La retirada es una nueva versión `active:false`.
- `orderCustomer`: asigna una clave canónica de cliente declarada y aprobada por el propietario. La misma clave identifica al mismo cliente sólo dentro de esa organización. No se valida contra un CRM ni se infiere de nombre, correo o relato. `customerKey:null` retira la identidad conservando la revisión.
- `relationCoverage`: acredita que se revisaron las relaciones del alcance mostrado. Debe enviar el alcance normalizado y el `inputHash` de la consulta actual, con versión esperada. Una lectura sin esta aprobación no demuestra ausencia de relaciones.

Las operaciones se exponen mediante `POST /api/economics`; la ruta autentica sesión, organización y origen CSRF. El backend vuelve a comprobar membresía actual, propietario, fuente activa y evidencia del problema. Las credenciales existentes permanecen en servidor. No hacen falta nuevas claves ni llamadas de inferencia.

Después de cambiar un registro, fuente, problema, alias, cliente o relación, la cobertura anterior deja de estar vigente. Actualizar la consulta, revisar el alcance y aprobar la cobertura de nuevo. La cobertura de relaciones no sustituye la completitud de la fuente financiera. La revocación del contribuyente o de la fuente invalida su evidencia; los errores de infraestructura no se transforman en listas vacías.

El global de órdenes y el agregado de todas las órdenes usan la misma unión de identidades canónicas. El agregado de todas las órdenes depende de la completitud de sus fuentes, no de la aprobación de relaciones con problemas. Las filas por problema pueden compartir órdenes y **no son aditivas**. Clientes se cuentan por conjunto de claves confirmadas y se muestran aparte: un importe desconocido no elimina una identidad conocida, pero falta de identidad o completitud deja el total desconocido y conserva lo conocido. Alias incompatibles o revocados nunca eligen arbitrariamente un importe.

Los eventos directamente vinculados y los asociados a órdenes vinculadas se unen por identidad de evento. Reversals y originales se conservan juntos para conciliación. El mismo evento presente en dos problemas cuenta una sola vez en el global. Reembolsos, reemplazos y soporte permanecen en familias separadas, con las reglas del kernel/adaptador aprobado. Un original ausente, importe desconocido o evidencia incompatible mantiene explícito el problema; no se recorta dinero para cuadrar cifras.

Todas las tablas nuevas son append-only. No borrar versiones para reparar un error: aportar una corrección con su razón y la versión actual. Si falla el CAS, consultar de nuevo antes de decidir; no sobrescribir a ciegas. Datos reales, aprobación financiera humana y completitud operacional dependen de evidencia del cliente. Los fixtures sintéticos prueban software, no esas afirmaciones.
