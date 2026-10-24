// Rutas de superadmin que no están en el MENU: consola de plataforma, ficha 360 y pantallas de acceso. Con `next dev` y VEXA_UI_FIXTURES=1 VEXA_UI_FIXTURES_PLATFORM=1
// existen todas (/sin-acceso y /seguridad tienen vista sintética solo bajo fixtures; en producción exigen sesión real).
export const SUPERADMIN_ROUTES=['/platform','/platform/organizaciones','/platform/organizaciones/00000000-0000-4000-8000-000000000001','/platform/fuentes','/platform/procesos','/platform/costos-ia','/platform/alertas','/platform/auditoria','/seguridad?requerido=1','/sin-acceso?admin=1','/sin-acceso?estado=vencida','/sin-acceso?estado=nada'];
// movil-contenido.mjs mide dentro de .workspace-content: solo las rutas con el shell de la consola (las pantallas de acceso se cubren en choques.mjs).
export const SUPERADMIN_ROUTES_SHELL=SUPERADMIN_ROUTES.filter(r=>r.startsWith('/platform'));
