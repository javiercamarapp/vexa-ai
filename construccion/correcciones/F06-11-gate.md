# F06-11 — examen externo de Web Push/PWA

Control recuperado de305 con nueve hashes exactos y actualizado sobre F06-09/F06-10 aceptadas. El resultado histórico no acredita la composición422/424 actual. La ausencia de implementación falla con `PUSH_IMPLEMENTATION_MISSING` antes de importar producto o crear infraestructura.

## Contrato

- SDK web-push estándar fijado; cifrado/VAPID real y descifrado independiente `http_ece` frente a un receptor TLS sobre socket Unix local. No se contactan proveedores ni dispositivos públicos.
- Validación de endpoints HTTPS permitidos, keys y copia inmutable antes de cualquier espera. Rechazo de sustitución del destino por SDK, redirecciones y configuración inválida. Abort/timeout cierran sockets y quedan inciertos; sólo429 confirmado autoriza reintento con backoff.410 desactiva únicamente la versión enviada.
- Fanout durable por dispositivo: un dispositivo aceptado no se reenvía por el429 de otro. Incertidumbre nunca se libera por suposición.
- API: identidad, sesión Auth viva, membership/tenant actual y Origin; ningún tenant/user/session proporcionado por el cliente autoriza acceso. Cuerpo limitado y con plazo. Endpoints/keys nunca aparecen en respuesta al navegador.
- SQL: dos tablas con RLS forzado, sin grants directos; RPC de backend restringidos por contexto. Tres FKs compuestas de tenant y vínculo Auth SET NULL con tombstone conservan historial. Revocaciones entre beginSend y preparación impiden red. El ledger conserva efectos reales después del logout.
- Payload únicamente texto genérico, ruta propia y binding opaco subscriptionId/version. El SW comprueba el dispositivo/versión actual y descarta payload viejo, ajeno o sin binding; ignora contenido/destinos del evento. No hay caché de identidad o datos de negocio.
- Consentimiento explícito; una visita no registra ni solicita permiso. UI distingue permisos, dispositivo y preferencias. Errores visibles y reintentos seguros no afirman que un POST ambiguo fue aceptado.
- Logout global depende de Auth, incluso para un administrador sin membership. El éxito revoca sesiones/dispositivos y conserva intentos; fallo de Auth sigue siendo503. El cambio de organización revoca el dispositivo dentro del scope autorizado.

## Ejecución y evidencia

`VEXA_CANDIDATE=/ruta/candidato node --test tests/acceptance/F06-11.test.mjs`

El gate compila una sola copia temporal instalada. Auth, PostgreSQL, REST, Storage, Next y Chromium son locales. Los controles TS del contrato de Auth utilizan SDK real con HTTP sintético y se distinguen del recorrido final de Auth real. Sus subprocesos eliminan únicamente NODE_TEST_CONTEXT para no omitir las pruebas; resultados TAP se conservan.

La matriz global añade clasificación y oráculos reales de tablas/FK/roles/sesión; no elimina controles anteriores. Los controles SQL de preparación reutilizan fixtures aisladas en la misma DB. Limpieza exclusivamente por recursos propios y sus identificadores.

## Límites

PushManager emite una suscripción sintética para evitar registrar un dispositivo real ante FCM; página, permiso, SW instalado, API y Auth/DB se prueban localmente. Los handlers exactos del SW se ejecutan también en VM con autorización HTTP real local. No acredita entrega nativa iOS/Android/Safari, recepción del sistema operativo, cuentas/VAPID productivas ni producción. El supervisor debe verificar y aceptar los mismos hashes congelados.
