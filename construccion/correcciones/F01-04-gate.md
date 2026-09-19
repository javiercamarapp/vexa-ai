# F01-04 — correcciones conservadas antes de congelar

Estado al19-sep2026,16:05: examen aprobado independientemente y trasladado al control-plane para congelación. Producto todavía no aceptado. No repetir autoría desde cero: reusar el soporte corregido y verificar su procedencia. Los recibos originales y artefactos sintéticos se conservan localmente.

## Alcance que no debe cambiar

F01-04 es shell autenticado, navegación/teclado/foco, ocho rutas, filtros URL y seis estados discriminados. No requiere implementar productores F06 para pasar diseño. Un backend posterior ausente debe producir error explícito y accionable, jamás ready/empty ni métricas inventadas. Esto no permite aceptar identidad rota o rol falso.

## Rechazos reales

1. **P1 fixture ilegible:** docker cp de fixture0600 dejó al usuario node sin lectura. Asignar al usuario del contenedor propio conservando0600; comprobar lectura. Nunca publicar cookie/JWT en logs/capturas; eliminar fixture al terminar.
2. **P1 dependencia circular:** exigir HTTP200 y links de registros producidos por F06 hacía imposible aceptar el alcance de diseño. Probar seis destinos y dos detalles directos. Aceptar200/503 de dependencia sólo con shell/organización/rol autorizados, error específico y acción; no aceptar errores de identidad ni datos listos ficticios.
3. **P2 retry no funcional:** href="#" y tabIndex=-1 sobrevivían. Exigir Tab/foco/Enter, nueva petición y render; mutantes separados deben morir por esas aserciones, no por infraestructura.
4. **P2 filtros sin validar:** alert503 genérico dejaba pasar moneda inválida o duplicada. Exigir códigos de validación específicos y mutante que elimina validación real del puerto.
5. **P1 rol no examinado:** fixture sólo owner permitía mutante que devolvía active.role='owner' para cualquiera. Crear owner/analyst/operator/viewer reales y comprobar rol conservado. Mutante debe morir por AUTHORIZED_ROLE_PRESERVED. Cuando API de acción existe, lower role debe403 antes de backend;503 no es denegación. Ausencia de endpoint F06 no obliga a implementarlo en F01-04.

## Evidencia y límite

Revisión anterior reprodujo probe7/7, Auth3/3 y mutante adicional de identidad rechazado, pero encontró el negativo de rol faltante. Tras corrección de rol, otra revisión ejecutó probe7/7, Auth3/3 con cuatro roles, role-probe1/1 y UI sin proveedor3/3; agotó900s antes de entregar veredictoJSON. **Timeout y TAP verde no sustituyen revisión aprobada.** Se abrió cierre separado: revisor del examen, QA de UI y regresiones sobre la misma fase, sin autores concurrentes ni nuevas features. El nuevo revisor aprobó sólo el examen: reprodujo role-probe1/1 y probe7/7, siete mutantes rechazados por sus oráculos; auditó hashes, evidencia Auth/layout/identity previa, capturas, privacidad y cleanup. El timeout anterior permanece inconcluso, no se reescribe como aprobación.

## Hallazgos de producto separados del examen

La primera revisión UI encontró refresh sin Set-Cookie en rutas fuera del middleware y reset de Customer Detail hacia /customers inexistente. Se reprodujeron ambos rojos y corrigieron en otro worktree inmutable para los revisores. Recheck focal aprobó cookies, reset con UUID, enlace raíz y el mismo correctivo integrado; prueba permanente en `apps/web/tests/workspace/recovery/run.py` dentro de la propuesta. No confundir esa aprobación con aprobación del examen o aceptación de F01-04.

Antes de promover: aprobación externa del examen, commit congelado, prepare/adopción permitida, verify, revisión de producto, TODOS los gates aceptados y controlador, accept con materialización limpia, publisher. No cambiar oráculos ni ampliar allowlist durante un candidato congelado.
