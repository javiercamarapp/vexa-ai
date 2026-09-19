# Cierre e integración — 19-sep-2026

Prioridad explícita del usuario: convertir lo construido en recorridos integrados y aceptados, no abrir más módulos. Se conserva alcance completo y los 60 IDs. Superadmin es ampliación separada, no se introduce silenciosamente en el denominador.

## Tablero actualizado — 10/60 aceptadas

F01-03 aceptado por runner en `009fd730810facd943bca548ee9e6ec7a7d55cb9`: gate168/168, regresiones25/25, controlador110OK y revisión independiente. Materialización limpia revalidada. Primer rechazo por modos0664/0644 preservado y corregido sin diferencias de contenido.

| Entregable | Construido/probado | Revisión independiente | Integración | Aceptación formal/límites |
|---|---|---|---|---|
| Identidad/scaffold | Auth local real | Aprobada | Baseline | Aceptados; Google remoto pendiente |
| Schema/RLS/Storage F01-03 | 168/168 + regresiones | Aprobada | Baseline009fd73 | Aceptado local, no producción |
| Instalación fresca | Migraciones0001–0007; export sinGit; pg/reinicio | Aprobada | Laboratorio444e7bb | Sin upgrade de DB existente; admin separado |
| Superadmin | 57unit,22DOM,16SQL | Correctivo aprobado | Laboratorio3fb3712 | Recorrido Auth/MFA y gate propio pendientes |
| Workspace/intervenciones/brief | SQL/Auth/Chromium y tramo vertical | Correctivo aprobado | Laboratorio582e4b3+d4c28dc | Medición real/Explorer pendientes; no F06 aceptado |
| Entrada CSV HTTP/UI | Upload/estado/replay/tenant/CSRF/Chromium | Aprobada | Laboratorio56f051b | No adaptadores productivos ni legacyH3 |
| CSV→recomendación→intervención→brief→inbox | Principal80SQL y HTTP/Auth/Chromium; sin semillas intermedias | Aprobada, con publicaciones concurrentes y versiones | Laboratoriod4c28dc | Gateway/Storage/redactor sintéticos; no backfill histórico, cierre sin medición correctamente409 |
| Navegación entre importación/inbox/preferencias | Clicks reales yAPI200 | Aprobada | Laboratorio40cb628/3c258a8 | No equivale a ocho vistas completas |
| Assign/dismiss | 11acciones+34SQL+26web y Auth/Chromium | Correctivo aprobado; capacidades por rol/estado/binding, legacy fail-closed | Laboratorio597c0ea | No amplía SQL ni acredita F06 completo |
| Notificaciones | SQL/HTTP/Chromium y flujo desde brief real | Correctivo aprobado | Laboratorio1101d0c+d4c28dc | Push/email, logout integrado y destinatario distinto pendientes |
| Shell F01-04 | Gate3/3;193regresiones+110controlador;Auth/Chromium4roles | Examen,QA ycompatibilidad aprobados | Baseline50674a4, aceptado con materialización limpia | Sólo diseño/UI/Auth; no proveedor ni accionesF06 completos |

Los SHA de laboratorio preservan código, no lo convierten en baseline aceptado. Se trasladan bytes revisados por allowlist y se registran hashes locales. No copiar repos enteros al candidato ni alterar su examen.

## Orden de cierre

1. **Cerrado:** examen F01-03 congelado y schema adoptado/aceptado mediante runner.
2. **Comprobado en laboratorio:** unión de módulos y siete migraciones canónicas en DB efímera nueva; ya no requiere aplicar SQL de paquetes fuera de orden.
3. **Comprobado localmente con puertos sintéticos declarados:** CSV autorizado → job → snapshot → recomendación persistida → intervención/plan/approved/active/measuring → brief → inbox. Falta conexión productiva y cierre con medición real; no se sustituyen por éxito simulado.
4. Cerrar huecos ya identificados (HTTP/importación, acciones restantes, medición y navegación) dentro de ese recorrido. No abrir módulos adicionales independientes.
5. Adoptar por ID, con examen externo desde contrato, regresiones y aceptación en materialización limpia. Publicar sólo SHA aceptado/control-plane revisado mediante publisher; Actions apagadas.

## Límites y bloqueos externos

Tanda vigente autorizada:120min, máximo3agentes DENTRO de una sola fase, hasta24nuevas invocaciones;128consumidas al inicio bajo techo220. Terminar/integrar antes de avanzar. La tanda anterior comenzócon107; no se borran sus consumos. Se conserva ventana anterior y cada rechazo. Construcción por suscripción ChatGPT, cero gasto incremental. No borrar STOP ajeno ni relanzar intentos agotados automáticamente.

Cloud, Google OAuth, CRM real, proveedores de IA/envío, DNS, datos autorizados y gold humano siguen requiriendo configuración/permisos y pruebas reales. El objetivo local es connection-ready; no afirmar producción validada ni 60/60 por pasar pruebas sintéticas.
