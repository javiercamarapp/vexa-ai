# Cambios

Formato libre, entradas más recientes arriba. La fuente de detalle es el historial de git (commits atómicos con la causa raíz en el mensaje).

## 2026-10-31 — Repositorio público reorganizado

- El historial se reescribió y el repositorio se recreó: se retiraron datos de un cliente piloto y el material interno de construcción (planes, informes de fase, dossier de negocio, evidencias de ejecución). Autoría, fechas y orden de los commits se conservan.
- `package.json`, la integración continua y las pruebas dejan de depender del andamiaje interno de construcción.
- El generador de las plantillas de correo de Auth pasa a `packages/notifications/auth-templates`.
- README, LICENSE, SECURITY, CONTRIBUTING y documentación de arquitectura reescritos con el estado real del producto.

## 2026-10-24 — Renombre a Rovaq AI

- El producto pasa a llamarse **Rovaq AI** (antes Vexa AI) en la interfaz, metadatos, correos y documentación.
- Descarga de respuestas del asistente: `rovaq-respuesta-<id>.md`.
- Sin cambios en identificadores técnicos (paquetes `@vexa/*`, esquema `vexa_platform`, variables `VEXA_*`).

## Antes

El producto se construyó por fases (fundamentos, importación, conectores, análisis, recomendaciones, notificaciones, robustez, release). Los hitos están en el historial de git.
