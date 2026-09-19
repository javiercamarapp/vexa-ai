# Ampliación explícita: superadmin, backoffice y costes — 19-sep-2026

Petición posterior del usuario: cuenta/dashboard de cliente y Google Auth; superadmin como referencia funcional de Likida/Atiende; cerebro operativo, prospectos, backoffice automatizado, control de gastos IA por rubro y notificaciones/correos de calidad producción. **No todos estos requisitos estaban en las60tareas originales.** Se mantienen completos los60IDs; esta ampliación no se oculta dentro de un PASS previo ni se considera implementada por escribirla.

## Contrato inicial de construcción
- Separar operador de plataforma de roles owner/analyst/operator/viewer de organizaciones. Ser owner de un tenant NO concede superadmin. Grant administrativo explícito, revocable, controlado en servidor/DB, sin promoción por email/metadata/body. Google autentica identidad; no asigna privilegios. Reautenticación/MFA para operaciones sensibles según política, fail-closed.
- Superadmin con cartera de organizaciones, estado de integraciones/trabajos, actividad y auditoría, costes/presupuestos y centro operativo. Información agregada mínima por defecto; acceso a contenido cliente requiere autorización/alcance explícitos y auditoría, no omnisciencia del panel.
- Cerebro: catálogo de automatizaciones/agentes, objetivo, estado/heartbeat, ejecución/historial, límites, tareas/aprobaciones/errores. No ejecutar prompts arbitrarios como shell/SQL ni activar gasto por aparecer una tarjeta. Cualquier acción con efecto externo pasa autorización específica.
- Prospectos: etapas, responsable, notas y próxima acción, procedencia/consentimiento/retención, conversión explícita a organización, no scraping ni envíos automáticos a personas por defecto. Registros sintéticos para pruebas.
- Backoffice durable: acciones locales permitidas, cola/leases/fencing/idempotencia, auditoría y aprobación previa de cambios sensibles. Reintentos limitados, errores visibles, pausa/kill-switch. No acciones arbitrarias generadas por modelo.
- Gasto IA por organización, agente, modelo/proveedor, rubro y ventana: extracción, embeddings, clasificación/agrupación, recomendaciones, explorer, briefs, backoffice y otros explícitos. Producto y operación interna se distinguen. Reserva antes de inferencia, liquidado/reservado/incierto separados, minor units y moneda explícitos, presupuesto/rate limits y alertas deterministas con procedencia. Falta de coste ≠0. SQL agregado sobre toda la población, no suma de primera página.
- Integración con gateway existente sin duplicar ledger ni permitir dos techos que ignoren el mismo gasto. Revisar condiciones del proveedor antes de habilitar llamadas reales. No inferencia pagada autorizada por construir este módulo.
- Notificaciones: inbox/preferencias y dispositivos de usuarios VEXA; eventos emitidos transaccionalmente, cola durable, consentimiento, templates responsive HTML/texto, identidad visual propia, previews y accesibilidad. Firma/replay de recibos, accepted≠delivered, incertidumbre sin reenvío ciego. Dominio/remitente/SPF/DKIM/DMARC y smoke reales siguen requiriendo configuración y destinatarios autorizados.

## Referencia permitida
Lectura selectiva de código de `~/likida/src/lib/auth/api-superadmin.ts`, `src/lib/admin/consumo.ts`, páginas admin/mapa-prospectos/cerebro y presupuesto; gateway/backoffice de `~/atiende-fusion`. Patrones y criterios, no copiar marca/código/secretos/datos de clientes ni cambiar esos proyectos. Corregir deficiencias observadas, no importarlas por imitación.

## Aceptación adicional obligatoria
1. Usuario sin grant, owner de tenant, sesión sin factor exigido y grant revocado fallan en páginas Y APIs.
2. Presupuesto concurrente por rubro/tenant no excede techo; timeout conserva reserva uncertain; sumas exactas y errores DB visibles.
3. Prospecto y acción backoffice exigen identidad/versión/idempotencia y generan auditoría; otro tenant o rol no puede modificar.
4. Cerebro muestra sólo ejecuciones reales; habilitar/configurar no dispara inferencia/envío implícito.
5. Plantillas/eventos probados con fixtures y preview; envío real/entrega se verifica aparte con proveedor configurado.

Las propuestas tienen propietarios disjuntos. Antes de promoción se deben añadir/revisar los IDs y gates correspondientes en un checkpoint limpio del grafo, conservar60IDs existentes y resolver bindings con el schema/gateway canónicos. No promover paquetes aislados como software completo. Plazo operativo actual: una hora restante indicada por el usuario, máximo trabajo paralelo útil y verificación; no garantía falsa de completar dependencias externas.
