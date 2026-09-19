# VEXA AI · investigación, blueprint y base verificable

**Carpeta canónica:** `/Users/javiercamaraportepetit/vexa` · fuera de iCloud. Preparación rehecha desde fuentes originales con Astra vía Codex. **No es todavía el SaaS completo ni un deploy.** Estado/recibos: [PROGRESO.md](PROGRESO.md).

## Empieza aquí
1. [Contexto e interpretación](docs/CONTEXTO-CANONICO.md): lo que dicen audios, DOCX y PRD; discrepancias y decisiones.
2. [Tesis/competencia/veredicto](docs/investigacion/01-tesis-competencia-y-veredicto.md): **CAMBIAR el posicionamiento**, no vender feedback→dinero como novedad exclusiva.
3. [Oferta CTO 30%](docs/investigacion/02-diligencia-cto-30-por-ciento.md): condiciones, diligencia y riesgos antes de comprometerte.
4. [Blueprint maestro de 30 días](docs/blueprint/00-BLUEPRINT-MAESTRO.md) y [trazabilidad de las 35 secciones](docs/blueprint/02-TRAZABILIDAD-PRD.md).
5. [Cómo construir/reanudar](orchestration/README.md): roles, skills, grafo, pruebas, límites y comandos.

## Fuentes privadas completas
- [Seis transcripciones completas con tiempos y limitaciones ASR](private/TRANSCRIPCIONES-COMPLETAS.md).
- [DOCX extraído](private/blueprint-original.txt); original en private/originals/.
- [PRD/encargo íntegro original de la sesión](private/PRD-Y-ENCARGO-ORIGINAL.md).
- [Manifiesto SHA256 y duraciones](private/manifest.json).
- private/transcripts/ y private/transcripts-contextual/: dos pasadas locales, TXT/SRT/JSON. Se procesaron **591.829333 s**, cerca de 9:52. No hubo revisión humana escuchando cada palabra; nombres/frases inciertos se señalan.

Estos links sólo funcionan en la copia local que contiene private/. Esa carpeta y logs no se suben a Git. No confundir preservación/transcripción completa con reconocimiento infalible.

## Investigación
- [Referencia Likida/Atiende](docs/investigacion/03-referencia-likida-atiende.md): revisión selectiva, no auditoría completa de todos los repos.
- [Modelos, costos y pricing](docs/investigacion/04-modelos-costos-pricing.md): catálogo público y escenarios rotulados; sin inferencia API pagada.
- [HubSpot→Zendesk](docs/investigacion/integraciones/01-hubspot-zendesk-migracion.md).
- [Supabase/datos/colas](docs/investigacion/integraciones/02-supabase-datos-seguridad-colas.md).
- [Vercel/ejecución durable](docs/investigacion/integraciones/03-vercel-ejecucion-durable.md).
- [OpenRouter/privacidad/modelos](docs/investigacion/integraciones/04-openrouter-modelos-privacidad.md).
- [MCP vs API y accesos](docs/investigacion/integraciones/05-mcp-vs-api-matriz-accesos.md).
- [Spikes y decisiones abiertas](docs/investigacion/integraciones/06-decisiones-riesgos-y-spikes.md).
- fuentes/: resultados developer index y páginas oficiales guardadas con URLs. Son evidencia para diseño, no prueba de configuración efectiva ni market sizing exhaustivo.

## Blueprint ejecutable por fases
| Fase | Días objetivo | Entregable |
|---|---|---|
| [F00](docs/blueprint/F00.md) | 1–2 | contratos, derechos, fixtures y gates |
| [F01](docs/blueprint/F01.md) | 2–5 | app/auth/tenancy/CI |
| [F02](docs/blueprint/F02.md) | 4–8 | importación y jobs durables |
| [F03](docs/blueprint/F03.md) | 6–12 | HubSpot/Zendesk y continuidad |
| [F04](docs/blueprint/F04.md) | 8–15 | modelos, evidencia, problemas |
| [F05](docs/blueprint/F05.md) | 12–18 | dinero/snapshots/prioridad |
| [F06](docs/blueprint/F06.md) | 15–23 | ocho vistas y acciones humanas |
| [F07](docs/blueprint/F07.md) | 22–27 | QA/resiliencia/piloto |
| [F08](docs/blueprint/F08.md) | 28–30 | release/pitch/entrega |

Días se solapan por trabajo de diseño/validación; un solo implementador no hace todas las tareas simultáneamente. Horizonte condicionado a accesos y scope; no promesa de resultado garantizado en 30 días.

[Contratos y modelo de datos](docs/blueprint/01-CONTRATOS-Y-DATOS.md) · [Motor financiero](docs/blueprint/calidad/01-contrato-motor-financiero.md) · [Gold/evals](docs/blueprint/calidad/02-conjunto-dorado-evaluacion.md) · [Seguridad](docs/blueprint/calidad/03-amenazas-rls-privacidad.md) · [E2E](docs/blueprint/calidad/04-aceptacion-end-to-end.md) · [Intervenciones/causalidad](docs/blueprint/calidad/05-intervenciones-medicion-causalidad.md).

## Operación
[Piloto y guion de pitch](docs/operacion/01-PILOTO-Y-PITCH.md) · [Runbooks y accesos](docs/operacion/02-RUNBOOK-Y-ACCESOS.md).

## Código que sí existe
- `packages/economics/index.mjs`: kernel puro limitado de dinero/exposición/refunds/escenarios.
- `tests/acceptance/economics.test.mjs`: contrato externo; soporta VEXA_CANDIDATE.
- `orchestration/runner.py`: controlador Codex acotado, candidatos aislados en Git worktree, gates y aceptación explícita.
- `tests/controller/test_runner.py`: tests unitarios y de integración con CLI Codex simulado.

```bash
cd ~/vexa
npm test
npm run test:controller
npm run graph:check
```
Node >=22 y Python3, sin instalar dependencias para esos tests. El grafo tiene 55 tareas; sólo E00 tiene gate escrito en esta etapa. Los otros 54 **bloquean** hasta preparar pruebas/entorno y resolver aprobaciones. No hay proceso autónomo de producción corriendo.

## Bloqueos que no puede inventar un agente
Acuerdo/NDA/DPA, derechos y muestra real Senix; responsables/fecha migración; cuentas/proyectos VEXA y presupuestos de runtime; gold humano y validación de negocio; scaffold/auth/RLS/ingesta/UI aún por implementar. El 30% no equivale a sociedad formalizada y un gasto sintético no equivale a ahorro real.
