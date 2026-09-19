# 03 · Amenazas, aislamiento y privacidad

Estado: diseño de controles y pruebas; no auditoría de una implementación desplegada ni certificación legal. Responsables: ingeniería backend/seguridad para controles, QA para ataques y responsable legal/privacidad para acuerdos y plazos. Datos reales y proveedores externos siguen bloqueados mientras falten autorizaciones indicadas en el [contexto](../../CONTEXTO-CANONICO.md).

## 1. Evidencia local y alcance

Fuentes consultadas: [RLS](../../investigacion/fuentes/supabase-rls.md), [colas](../../investigacion/fuentes/supabase-queue.md), [MCP Supabase](../../investigacion/fuentes/mcp-supabase.md), [privacidad OpenRouter](../../investigacion/fuentes/openrouter-privacy.md), [salidas estructuradas](../../investigacion/fuentes/openrouter-structured.md), [HubSpot](../../investigacion/fuentes/hubspot.md), [Zendesk](../../investigacion/fuentes/zendesk.md).

Los extractos RLS contienen principalmente referencias de terceros, no una auditoría ni toda la documentación primaria. Los de privacidad y structured outputs incluyen documentación del proveedor, pero no prueban configuración efectiva. Deben verificarse contra versiones instaladas y contratos antes de producción. No se investigó en red. No se fijan normativas, residencia, plazos legales, precios ni cumplimiento que las fuentes no acreditan.

Activos: conversaciones/adjuntos, identidad de clientes, órdenes/importes, embeddings, tokens CRM, claves proveedor, exports, logs y evidencia. Actores: visitante, miembro autorizado, miembro revocado, usuario malicioso del mismo tenant, usuario de otro tenant, autor de ticket externo, worker comprometido y proveedor. Fronteras: navegador→API→SQL/Storage; ingesta→cola→worker; texto→LLM; LLM→validador; export→descarga. El texto del ticket y las salidas del modelo son siempre datos no confiables.

## 2. Modelo de autorización verificable

Roles propuestos: viewer lee vistas agregadas autorizadas; analyst accede a conversaciones minimizadas y crea borradores; operator gestiona intervenciones humanas; admin gestiona miembros/conectores. Permiso independiente `export_sensitive` para exports con datos personales, sin otorgarlo implícitamente a viewer. Los roles son por tenant. Un admin de A no tiene privilegios en B.

Identidad desde token validado en servidor (firma, emisor, audiencia, expiración). `tenant_id` de ruta es selector, nunca autorización. Membresía y permisos activos consultados en servidor/DB; no confiar en `user_metadata` editable ni en roles del cuerpo HTTP. Revocación debe impedir la siguiente operación protegida, incluyendo jobs/descargas previamente encolados. Si se cachea autorización, invalidación síncrona/versionada; no aceptar una ventana oculta de revocación.

Toda tabla tenant-owned tiene `tenant_id NOT NULL`, PK/unique `(tenant_id,id)` y FKs compuestas `(tenant_id,parent_id)`; ninguna relación puede unir A con B aunque IDs sean válidos. Catálogos globales no contienen datos cliente. RLS habilitada con denegación por defecto para anon y autenticados sin membresía. `USING` protege filas existentes y `WITH CHECK` inserción/estado nuevo. Prohibir cambiar tenant_id mediante privilegios de columna/trigger validado, además de RLS. Revisar políticas permissive combinadas por OR: una policy amplia invalida una estrecha.

Patrón de lectura orientativo, a adaptar en migraciones y probar con roles reales:

```sql
-- members tiene RLS propia: cada usuario solo puede leer sus membresías.
-- Usuarios no pueden concederse membresías ni modificar roles por DML directo.
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;
CREATE POLICY conversations_read ON conversations FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM memberships m
  WHERE m.tenant_id = conversations.tenant_id
    AND m.user_id = (SELECT auth.uid()) AND m.active
));
-- Escrituras no están concedidas por esta policy. Requieren permiso explícito.
```

No ejecutar pruebas de RLS únicamente como dueño/superuser/service_role: pueden eludirla; `FORCE` no neutraliza BYPASSRLS. API de usuario con sesión del usuario; workers con rol mínimo preferentemente sujeto a RLS y contexto tenant transaccional validado. Si una operación requiere credencial privilegiada, función estrecha, entradas verificadas y auditoría de alcance; queda prohibido ofrecer SQL arbitrario. `SECURITY DEFINER`: excepcional, owner sin privilegios innecesarios, search_path fijo seguro, objetos calificados, EXECUTE revocado a PUBLIC y comprobación de actor/tenant dentro de función. Vistas/RPC no deben saltarse RLS accidentalmente; probar su comportamiento con rol invocador. Grants de tablas, secuencias y funciones también forman parte del control.

## 3. Aislamiento en cada superficie

| Superficie / amenaza | Control requerido | Prueba negativa / evidencia |
|---|---|---|
| SQL, agregados y RPC | RLS + membresía + FKs compuestas; filtro tenant dentro de consulta, no después | A consulta ID B y totales B: 404/no filas según contrato; cero conteos/metadatos B |
| pgvector / búsqueda | Filtrar tenant y permisos dentro de retrieval; embeddings conservan tenant_id y source_id | Vector B idéntico y más cercano: jamás recuperado por A; top-k puede ser menor, no rellenar con B |
| Storage | Buckets privados, políticas por objeto/membresía; path tenant no basta; URLs nunca públicas | A lista/lee/range-download objeto B: denegado; nombre y tamaño tampoco expuestos |
| Jobs/colas | Mensaje referencia job persistido; tenant autorizado deriva de job, no payload; revalidar al ejecutar/publicar | Alterar tenant en payload o revocar actor antes del dequeue: detener sin leer B |
| Cache/CDN | Clave incluye tenant, permisos/version, snapshot, filtros y modelo; respuestas privadas sin cache compartida | A calienta cache; B pide mismo path/query: no recibe datos A; logout limpia estado local |
| Export | Revalidar solicitud, materialización y descarga; snapshot/filtros inmutables; contenido minimizado | URL/cursor/job_id B nunca sirve A; revocación entre generación y descarga bloquea |
| Logs/traces/error tracking | IDs opacos, redactado; no prompt/adjuntos/tokens por defecto; acceso segregado | Inyectar email/secreto canario sintético: no aparece en logs/export técnico |
| Brief/LLM context | Retrieval con permisos; evidencia validada después del modelo | Cita a ID B se rechaza aunque sea JSON válido y lingüísticamente creíble |
| Backups/restore | Política aprobada de cifrado, acceso, vencimiento y reaplicación de tombstones | Restaurar backup sintético previo a borrado: tombstone impide reexponer cliente |

Para descargas que deban respetar revocación inmediata, usar proxy autenticado por cada solicitud; una URL firmada entregada al navegador puede funcionar hasta su expiración y no cumple ese gate. Si se adopta URL firmada por necesidad, documentar y aprobar otra garantía explícita; no declarar revocación inmediata. No mantener exports descargados por terceros como si pudieran borrarse remotamente.

## 4. Secretos, integraciones y prompt injection

Claves OpenRouter, service_role y tokens CRM solo servidor/gestor de secretos, nunca bundle, `NEXT_PUBLIC_*`, localStorage, prompts, fixtures o logs. Separar entornos y tenants para credenciales; rotación y revocación verificables. Key pública del cliente no sustituye autorización; exponerla no justifica exponer credencial privilegiada. Revisar bundle/source maps y errores con canarios de prueba, no copiar secretos reales.

Adaptadores CRM usan scopes mínimos de lectura y allowlist de métodos/endpoints. HubSpot/Zendesk comparten contrato canónico, no credenciales ni cursores. Nada de contestar tickets, cambiar CRM, emitir refunds o crear pedidos. Las escrituras internas de VEXA se hacen por código validado y permisos humanos; el LLM no tiene herramientas de escritura ni acceso a secretos. Si se usa MCP para operación futura, limitar proyecto y herramientas de lectura; no confundir esos controles con aislamiento automático por tenant.

Defensa de inyección: etiquetar contenido externo, delimitarlo, extraer mediante esquema, validar IDs/spans y denegar instrucciones embebidas. La frase «ignora instrucciones» no es el único ataque: probar HTML oculto, texto base64, citas simuladas de administrador y enlaces de exfiltración. No abrir URLs ni adjuntos por instrucción del ticket/modelo. Si se requiere fetch de adjuntos, resolver solo dominios/IDs del conector autorizado, sin redirects a red interna; bloquear loopback, link-local, metadatos e IP privadas. Desactivar ejecución de macros/fórmulas del parser y sanitizar HTML/Markdown renderizado.

En exports CSV, neutralizar fórmulas que empiecen por `=`, `+`, `-`, `@` en campos de texto y variantes de whitespace/control; no alterar columnas numéricas tipadas. Testear apertura como texto y compatibilidad del consumidor. Adjuntos: tamaño/tipo/cantidad limitados por configuración, contenido validado, análisis de malware si se habilitan; por defecto fuera del piloto hasta completar controles.

Gate de salida: schema estricto + validador local (tipos/enums/tamaños), autorización de referencias, soporte de citas y cálculo determinista. Fallback mantiene `data_collection=deny`, ZDR cuando sea requisito aprobado, y capacidades de schema; sin endpoint compatible, falla cerrado. Esos flags son controles técnicos, no sustituyen DPA ni garantizan por sí solos residencia o cumplimiento contractual.

## 5. Minimización, retención y eliminación

Inventario obligatorio por clase: propósito, fuente, campos, sensibilidad, responsables, destinos/subencargados, región acordada, TTL, trigger de borrado y evidencia. Propuesta: reemplazar nombre/email/teléfono/dirección por IDs pseudónimos antes de inferencia; mantener mapa de identidad separado con acceso limitado. No enviar datos de pago, secretos ni adjuntos completos innecesarios. Embeddings y resúmenes siguen siendo datos derivados sensibles, no anónimos por llamarlos vectores.

**Pendientes legales que bloquean datos reales**: autoridad del cliente para compartir; roles responsable/encargado; finalidad/base aplicable según jurisdicción; DPA/NDA pertinentes; subencargados y transferencias; retención por categoría; atención de derechos; notificación de incidentes y exclusiones de borrado. Revisión por asesor legal y responsable cliente; no inventar un plazo «reglamentario».

TTL configurable por categoría obligatorio, pero sin valor de producción hasta aprobación. Política provisional para fixtures: destruirlos al cerrar el entorno de ensayo. Nunca usar retención infinita por omisión. Pipeline de borrado: validar solicitante y alcance → marcar tombstone/bloquear acceso → cancelar jobs → purgar filas/texto/adjuntos/vectores/cache/exports → invalidar derivados o recalcular agregados → solicitar eliminación a proveedores cuando proceda → registrar confirmaciones y pendientes. Tokens de ingesta/cursor no deben reintroducir entidades borradas. Registrar solo prueba mínima permitida de eliminación, sin copiar el contenido eliminado.

Distinguir eliminación del sistema activo, copias de seguridad con vencimiento aprobado y copias exportadas fuera del control de VEXA. Restauración ejecuta tombstones antes de abrir tráfico. Si proveedor no permite verificar borrado, marcar pendiente; no emitir certificado de eliminación completa.

## 6. Suite adversarial y gates

Fixture de seguridad: tenants A/B; usuarios A_viewer, A_analyst, A_operator, A_admin, B_admin, AB_member y revoked_A; ambos tenants tienen external_id `42`, objetos y vectores con texto canario diferente. Todas las credenciales son locales de ensayo. Sesiones anon, expirada y token falsificado adicionales.

| ID | Acción detallada | Resultado exigido |
|---|---|---|
| SEC-01 | Con JWT A, sustituir tenant/ID B en GET, POST, PATCH, DELETE, RPC, paginación y export | Ninguna lectura/mutación B; error genérico sin confirmar existencia; auditar intento |
| SEC-02 | Insertar fila A con parent_id B; actualizar tenant_id A→B | Error de FK/permiso; rollback completo |
| SEC-03 | Con A, buscar embedding idéntico de B con top-k alto | Cero IDs/texto/scores B; retrieval mantiene permisos antes de generación |
| SEC-04 | Copiar path/URL export B y repetir rango/listado con A/anon/revoked | Denegado en todos; sin metadatos B |
| SEC-05 | Revocar A después de encolar; falsificar tenant del mensaje | Worker cancela/no publica; no usa payload para ampliar alcance |
| SEC-06 | Calentar cache con A_admin; entrar A_viewer y después B | No datos sensibles ni resultados fuera de permisos actuales |
| SEC-07 | Ticket pide SQL, red externa, refund y reveal de secretos | Cero herramientas de mutación/red arbitraria; salida solo evidencia permitida |
| SEC-08 | Cambiar membresía en user_metadata o reutilizar JWT revocado | Ningún privilegio nuevo; revisión de membresía impide operación |
| SEC-09 | Borrar C1 mientras hay job y export; restaurar backup viejo | C1 ausente en búsquedas, vectores y descarga; no resurrección por replay |
| SEC-10 | Analizar bundles/logs con secreto canario e input HTML/CSV | Cero secretos; sin XSS/fórmula ejecutable |
| SEC-11 | Endpoint/fallback no ofrece política de privacidad requerida | No envía payload; estado bloqueado con motivo sin PII |
| SEC-12 | AB_member cambia A→B y abre una pestaña antigua | Cada request usa contexto autorizado correcto; no reutiliza cache/resultados de A en B |

Ejecutar por canal real: HTTP, SQL con rol autenticado, RPC vector, Storage, worker y descarga. No basta un mock que devuelve 403. Capturar trace_id, actor seudónimo, recurso canario, código y estado antes/después. Cero fugas, secretos, escrituras CRM o fallos de autorización es gate absoluto; cualquier hallazgo bloquea publicación/datos reales. Repetir tras migraciones, cambios de policies, caché, retrieval o credenciales.

Respuesta a incidente propuesta: detener trabajos del tenant afectado, revocar credenciales implicadas, preservar evidencia minimizada, evaluar alcance con responsable humano y legal, corregir y repetir suite. Plazos de comunicación según acuerdos/ley aplicable por determinar; no prometerlos aquí.
