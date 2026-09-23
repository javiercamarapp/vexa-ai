# F06-08 — control independiente de dominio y SQL (295)

Controles escritos desde ficha, contratos y banco read-only; no se copiaron tests del autor.

- Ausencia semántica de módulo/migración antes de iniciar recursos. Catálogo de seis eventos, tres canales explícitamente no conectados; preferencias por defecto false y errores de DB no convertidos en vacío.
- Payload estricto, CAS entero, cursor ligado a tenant/usuario/rol/versión de permisos/filtro/límite y fecha con microsegundos válida. Se reprodujo Feb30 aceptado; el autor añadió roundtrip de calendario. Mutante que quita usuario del binding muere por aislamiento y restaura verde.
- Tres tablas nuevas clasificadas sin relajar la matriz previa; FORCE RLS, grants mínimos de columnas, seis FK tenant-aware con positivos y negativos. Authenticated/service_role no acceden; emisión privada sin INSERT concedido al backend.
- Cinco roles activos leen sólo inbox/preferencias propios; miembro invitado/revocado/externo y contactos CRM no reciben acceso. Estado leído pertenece exclusivamente al usuario y conserva primera fecha en replay. La versión de preferencia sólo avanza uno; CAS obsoleto no escribe.
- Recurso vigente en cada lectura y cambio leído: brief financiero con fuente retirada, intervención con evidencia retirada y asignación, welcome de usuario coincidente, conexiones owner, procesamiento owner/analyst. No textos, importes ni direcciones arbitrarios persistidos.
- Helpers: search_path vacío, autorización de capacidad ausente cerrada, wrapper read privado sin EXECUTE backend y restauración de notify. El helper portable DB prueba Auth real, cuatro roles, pool compartido, scope expirado y notify incapaz de escritura financiera o configure de viewer.

Correcciones del control preservadas: el enlace de intervención necesita alcance capturado del repositorio, por lo que el catálogo puro retorna null; la navegación real pertenece a294. El job clonado para una rama de recurso repetía UNIQUE(tenant,type,input_hash,version): diagnóstico23505 y cambio exclusivo a input_hash sintético nuevo, sin alterar producto ni oráculo. Probes especiales conceden sólo la tabla temporal exam_result, como el helper autorizado de la matriz.

La evidencia final y hashes se entregan en private/f0608-domain-295.json. Matriz28 sólo después de focalverde y fuente congelada; las corridas anteriores y sus errores de fixture permanecen disponibles. No equivale a envío email/push, emisores, outbox ni F06-09..12.

Recuperación supervisada: segundo fallo de fixture23514 correspondía a connections_status_check por usar revoked, valor inexistente en0002. Se conservó el payload exacto y se sustituyó únicamente por disconnected. La rama afectada pasó3/3 sin relajar el resultado esperado de lectura vacía. El resto focal previo pasó12/12; no se presenta la corrida intermedia11/13 como verde.
