# Corrección de acceso normal y soporte — 26-oct-2026

`vexa_member` devolvía una expresión SQL OR que consultaba `vexa_support_active`, una función privada del backend. PostgreSQL comprobaba su permiso EXECUTE incluso cuando la membresía normal era válida. Un usuario `authenticated` podía recibir SQL42501 en vez del resultado autorizado.

La migración `20261129000000_member_support_short_circuit.sql` separa las ramas: primero comprueba la membresía; solo `vexa_backend` puede consultar soporte, y únicamente si los roles solicitados incluyen viewer. Mantiene SECURITY INVOKER, STABLE, search_path vacío y la ACL original. No cambia datos ni concede permisos.

Prueba: `node --test supabase/tests/member-support-short-circuit.test.mjs`, 27/27 PASS en PostgreSQL 17 efímero. Reproduce el fallo anterior y verifica miembros owner/viewer, otros tenants, extraño, anónimo sin EXECUTE, soporte activo, solo lectura, roles de escritura rechazados, administrador inactivo y sesiones terminadas/expiradas. La guarda aborta ante una versión inesperada de la función.

Aplicada en producción mediante la herramienta de migraciones de Supabase el 26-oct-2026, registrada como `20261026204139_member_support_short_circuit` (la herramienta asigna su timestamp). Es la misma migración que el archivo local `20261129000000`; no volver a ejecutarla ni interpretar la diferencia de versión como pendiente. Cuerpo anterior MD5 `127d396d5dcefa3f2d954ddf146005bf`; posterior `23bceaaa057c47f7de56d041e6847848`. Catálogo remoto posterior: invoker, stable, search_path y ACL sin cambios; el helper continúa denegado a anon/authenticated.

Una transacción remota READ ONLY confirmó que una membresía activa real es aceptada y que otro tenant y un sujeto ajeno son rechazados, sin devolver identificadores ni cambiar filas. Esto no sustituye las pruebas completas de interfaz o de recuperación gestionada. La web continúa en `e71b71e8b5c4a6f67cae83bd7a1e4168637a77fd`; la corrección SQL entra en vigor sin reconstruirla.
