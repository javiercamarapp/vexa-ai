# Cierre e integración — 19-sep-2026

Prioridad explícita del usuario: convertir lo construido en recorridos integrados y aceptados, no abrir más módulos. Se conserva alcance completo y los 60 IDs. Superadmin es ampliación separada, no se introduce silenciosamente en el denominador.

## Tablero actualizado — 9/60 aceptadas

F01-03 aceptado por runner en `009fd730810facd943bca548ee9e6ec7a7d55cb9`: gate168/168, regresiones25/25, controlador110OK y revisión independiente. Materialización limpia revalidada. Primer rechazo por modos0664/0644 preservado y corregido sin diferencias de contenido.

| Entregable | Construido y probado | Integración | Aceptación pendiente |
|---|---|---|---|
| Identidad/scaffold | Aceptados previamente | Baseline | Google remoto no validado |
| Schema/RLS/Storage F01-03 | Revisado y168/168 | Baseline009fd73 | Aceptado localmente; no producción |
| Examen externo F01-03 | 73controles/mutantes; revisión correctiva aprobada | Control-plane | No equivale a producto |
| Superadmin | 57unit,22DOM,16SQL; correctivo revisado | Laboratorio, commit3fb3712 | Auth/MFA/recorrido completo y gate propio |
| Workspace/intervenciones/brief | Recheck independiente SQL/Auth/Chromium aprobado | Rama integrada582e4b3 | Assign/dismiss, Explorer y productor de mediciones |
| CSV/pipeline/jobs | Upgrade real revisado;20SQL y42unit del revisor | Rama integradacd00085 | H1entradaHTTP; compatibilidad legacyH3; recorrido completo |
| Notificaciones | Correctivos SQL/HTTP y50unit; revisor probó Chromium | Rama integrada1101d0c; principal repitió SQL/HTTP combinado | Push/email real, logout y destinatario distinto pendientes |

Los SHA de laboratorio preservan código, no lo convierten en baseline aceptado. Se trasladan bytes revisados por allowlist y se registran hashes locales. No copiar repos enteros al candidato ni alterar su examen.

## Orden de cierre

1. **Cerrado:** examen F01-03 congelado y schema adoptado/aceptado mediante runner.
2. Reunir workspace, ingesta y notificaciones revisados en una sola rama; aplicar migraciones en una DB efímera nueva y ejecutar suites combinadas. Corregir dependencias de instalación, no ocultarlas con orden manual sin documentar.
3. Probar usuario autorizado → importación → job → snapshot → vistas → intervención → brief → inbox. Un eslabón ausente bloquea ese recorrido, no se reemplaza con respuestas vacías o éxito simulado.
4. Cerrar huecos ya identificados (HTTP/importación, acciones restantes, medición y navegación) dentro de ese recorrido. No abrir módulos adicionales independientes.
5. Adoptar por ID, con examen externo desde contrato, regresiones y aceptación en materialización limpia. Publicar sólo SHA aceptado/control-plane revisado mediante publisher; Actions apagadas.

## Límites y bloqueos externos

Nueva tanda de integración supervisada autorizada por el usuario:120min,3agentes simultáneos como máximo, hasta24nuevas invocaciones;107consumidas al inicio bajo techo acumulado220. Se conserva ventana anterior y cada rechazo. Construcción por suscripción ChatGPT, cero gasto incremental. No borrar STOP ajeno ni relanzar intentos agotados automáticamente.

Cloud, Google OAuth, CRM real, proveedores de IA/envío, DNS, datos autorizados y gold humano siguen requiriendo configuración/permisos y pruebas reales. El objetivo local es connection-ready; no afirmar producción validada ni 60/60 por pasar pruebas sintéticas.
