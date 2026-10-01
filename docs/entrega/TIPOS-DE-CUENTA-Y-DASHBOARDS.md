# Tipos de cuenta y vistas de VEXA

Guía funcional de cuentas y pantallas. Los roles se asignan por organización; una cuenta sólo puede acceder al espacio de trabajo de una organización mediante una membresía vigente. Las decisiones de negocio permanecen sujetas al estado, evidencia y contexto autorizado que devuelve el servicio.

VEXA tiene un espacio de trabajo compartido para cada organización. Los cuatro tipos de membresía ven la misma estructura; las acciones disponibles cambian según su rol y, para intervenciones, según la asignación y el estado. No existen cuatro dashboards independientes.

| Tipo de cuenta | Uso principal y acciones existentes |
|---|---|
| Propietario (`owner`) | Administra el equipo. Puede proponer recomendaciones, preparar y aprobar intervenciones, asignar responsables, registrar ejecución, cancelar o reabrir mediciones y generar briefs. Las condiciones de evidencia y estado siguen aplicando. |
| Analista (`analyst`) | Consulta y analiza evidencia; propone recomendaciones y prepara planes de intervención. Puede generar briefs. No aprueba ni administra el equipo. |
| Operador (`operator`) | Consulta, propone recomendaciones y prepara planes. Puede registrar ejecución y medición cuando es el responsable vigente de la intervención. No aprueba planes ni administra el equipo. |
| Consulta (`viewer`) | Consulta las vistas y la evidencia disponible. No propone ni modifica recomendaciones o intervenciones y no genera briefs. |
| Administración de plataforma | Concesión separada: administra organizaciones y equipos, y consulta actividad administrativa. No concede por sí misma acceso al contenido de negocio de esas organizaciones. |

## Ocho vistas del espacio de trabajo

| Vista | Ruta | Función |
|---|---|---|
| Resumen ejecutivo | `/overview` | Prioridades, cifras, cobertura y procedencia del alcance seleccionado. |
| Problemas de negocio | `/problems` | Lista de problemas y navegación a sus detalles. |
| Detalle del problema | `/problems/[id]` | Desglose y evidencia contextual de un problema. |
| Recomendaciones | `/recommendations` | Consulta y propuesta de acciones ligadas a evidencia; las capacidades de modificación proceden del servicio. |
| Explorador de evidencia | `/explorer` | Exploración dentro del alcance y las fuentes disponibles. |
| Historial del cliente | `/customers/[id]` | Información y evidencia de una identidad conocida; se abre desde enlaces contextuales. |
| Intervenciones | `/interventions` | Plan, responsable, aprobación, ejecución y medición; cada acción depende del estado y la capacidad devuelta. |
| Brief ejecutivo | `/briefs` y `/briefs/[id]` | Generación autorizada, consulta de versiones y exportación del brief. |

El menú también agrupa gestión económica, gestión de problemas, análisis, importaciones, conexiones, histórico, evaluación y comparación de migración. Incluye notificaciones, preferencias, equipo y retención. Estas rutas auxiliares no son nuevos tipos de cuenta ni dashboards adicionales.

## Presentación del acceso

El espacio de trabajo comparte tipografía, botones, diálogos y navegación móvil/escritorio. En Equipo, primero se comprueba el acceso mediante su consulta real: sólo una respuesta autorizada muestra gestión. Una cuenta sin acceso recibe una explicación y puede actualizar; un fallo de conexión se presenta como error, sin afirmar que no hay integrantes. La pantalla conserva el diseño compartido y la autoridad del backend.

## Comprobación de Equipo — 1 de octubre de 2026

La corrección evita ofrecer administración de Equipo antes de confirmar acceso. Se comprobaron 16 escenarios locales con Auth, PostgreSQL y aplicación reales: ocho en Chromium de escritorio y ocho en WebKit móvil. Incluyen analista, operador y consulta sin controles de administración; propietario autorizado; cancelación del diálogo; error de conexión y recuperación; administración de plataforma y retirada de su concesión. No se enviaron invitaciones ni solicitudes de mutación.

Lint y compilación terminaron correctamente. Ocho controles ligeros de presentación y un control adicional con respuesta POST403 simulada complementan el recorrido; este último no acredita una entrega real. Se comprobó la eliminación de los seis recursos de prueba y sus procesos. El control específico no ensayó la degradación de propietario a analista durante la sesión ni todas las rutas auxiliares.

## Evidencia y límites

Los servicios de recomendaciones, intervenciones y briefs determinan las acciones disponibles; la interfaz respeta esas capacidades. Administración de plataforma verifica su concesión de acceso por separado.

[Alcance y evidencia general de interfaz](../../construccion/F06-07-CIERRE-TECNICO.md) · [Auditoría de 20 rubros](AUDITORIA-20-RUBROS-2026-10-01.md).

Este documento describe la composición actual. No afirma validación de todos los botones, dispositivos, ramas, permisos globales ni producción. La evidencia UI heredada F06-07 conserva su alcance; el recorrido focal de Equipo se documenta por separado y no amplía esa cobertura a todas las rutas. Cuentas, proveedores, datos reales y aprobación humana conservan sus pendientes.
