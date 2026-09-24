# VEXA AI · construcción e integración verificable

**Carpeta canónica:** `/Users/javiercamaraportepetit/vexa` · fuera de iCloud. Preparación rehecha desde fuentes originales con Astra vía Codex. **No es todavía el SaaS completo ni un deploy.** Estado/recibos: [PROGRESO.md](PROGRESO.md).

## Checkpoint vigente —43/60 técnicamente listas; 25 aceptadas en el grafo

F06-08 integra el centro de notificaciones, preferencias propias con control de versiones, lectura idempotente y enlaces a recursos autorizados. API/navegador15/15, gate oficial y aceptación Git limpia22/22, matriz SQL381/381. Tipos, lint, compilación, autenticación, navegación y controlador125/125 verificados. Alcance: construccion/F06-08-CIERRE-TECNICO.md. F06-09 conserva un bloqueo de revisión que no se reintenta ni transfiere. Se cierran trabajos independientes autorizados: histórico/evaluación, equipo/acceso por correo, retención, recuperación y entrega; sus recibos vigentes están en PROGRESO.

El total suma25 aceptadas por el runner y dieciocho técnicamente listas con dependencia/validación externa pendiente: seis F03, seis F05 y F06-01..06. Restan17 tareas de construcción y la auditoría integral de20 rubros. El cierre solicitado exige todo el software técnico de punta a punta, incluida ingesta histórica CRM y evaluación de agentes; sólo cuentas, datos, credenciales y aprobaciones externas pueden quedar pendientes. No acredita producción. Registro: construccion/ESTADO-CONSTRUCCION.json.

Tiempo sin límite autorizado; presupuesto conservado al corte de este checkpoint:357/360 invocaciones acumuladas, máximo3 agentes y cero gasto externo nuevo. Caffeinate mantiene pantalla y sistema despiertos con tapa abierta; no garantiza supervivencia de la sesión. Publicación mediante publisher autorizado, Actions desactivadas y SHA remoto verificado. Los apartados siguientes son históricos.

## Estado de construcción — corte 20-sep
**17/60 tareas aceptadas; F02 completa en6/6.** Importación, persistencia canónica, worker durable y UI de recuperación integrados. F02-05 (`9e738b9`) y F02-06 (comportamiento existente en `63b9725`, sin parche artificial) pasaron sus27grupos de verifyNode22 y acceptGitlimpioNode26. Compilación integrada, regresiones F02-01/02/03/04 y cuatro jobs CI locales verdes; huellas y limpieza verificadas. Siguiente fase: F03, HubSpot/Zendesk y migración. Actions permanece desactivado; no acredita producción.

Se conserva una incidenciaCSV previa no reproducida cuya causa original sigue desconocida. El examen guarda/exige estado terminal/checkpoint/rechazo antes de descargar, sin cambiar bytes esperados ni añadir reintentos; revisión y rojo/verde específicos aprobados. Seguimiento pendiente en auditoría integral final.

**Entrega solicitada:** todo el blueprint y lo pedido en los audios, integrado y listo para conectar credenciales/autorizaciones externas sin programar piezas faltantes. El objetivo connection-ready no reduce el alcance ni equivale a validación productiva con cuentas reales. Supabase propio está creado; migraciones remotas y conexión de aplicación siguen pendientes.

Prioridad vigente: **[cerrar e integrar lo ya construido](construccion/CIERRE-INTEGRACION.md)**. Workspace, CSV/pipeline e inbox tienen correctivos revisados en una rama de integración; no son todavía todas las tareas F02–F06 aceptadas. [PROGRESO.md](PROGRESO.md) distingue baseline, laboratorio, pruebas y pendientes.

Programa y guardias: **[AUTOMATICO.md](AUTOMATICO.md)** · **[alcance completo](construccion/ALCANCE-CONFIRMADO.md)**. El principal promueve serialmente; no lanzar otro supervisor mientras haya candidatos/ensayos activos. Consultar recibos y procesos: este documento no acredita que siga vivo un worker. Google remoto, proveedores, CI remoto y producción siguen pendientes; Actions permanece desactivado.

## Tecnologías y lenguajes en GitHub
- Interfaz: React/Next.js con TypeScript; lógica de negocio: Node.js/JavaScript.
- Datos y permisos: PostgreSQL/SQL; construcción y verificación: Python y Node.js.
- GitHub calcula porcentajes por bytes, no por la importancia de cada componente. Los HTML de la guía y del informe son documentación generada; `.gitattributes` los identifica sin excluir código fuente ni forzar un lenguaje principal.

## Construcción guiada de punta a punta
**[Empieza aquí: guía de construcción](construccion/README.md)** · [60 fichas](construccion/05-TAREAS.md) · [Guía HTML continua](construccion/GUIA-COMPLETA.html) · [PDF](construccion/GUIA-COMPLETA.pdf) · [Comparación con Likida](construccion/00-COMPARACION-LIKIDA.md).

Ciclo control-plane → gate externo → prepare/run → verify → revisión → accept; recuperación supervisada, contratos y runbooks. El inventario vigente se consulta con `python3 scripts/guide.py audit`; presencia de un gate no significa aceptación. El scaffold pasó en candidato y materialización limpia. **Guía completa no equivale a loop totalmente desatendido ni SaaS terminado.**

## Investigación de negocio ampliada — TAM, SAM, SOM y finanzas
**[Índice del estudio completo](negocio/README.md)** · **[TAM/SAM/SOM](negocio/05-Precios-y-Finanzas/tam-sam-som.md)** · **[Excel de mercado/finanzas](negocio/05-Precios-y-Finanzas/VEXA-MERCADO-Y-FINANZAS.xlsx)** · **[Informe HTML](negocio/INFORME-VEXA.html)**.

Base oficial: 2,975 firmas ecommerce/venta por catálogo USA en bandas de receipts $10M–<$100M (Census2022), no clientes calificados. TAM núcleo a precio base supuesto ~$53.5M/año; SAM base escenario ~$10.6M; SOM base A3 ~$989K ARR. Filtros, precios y forecast no son métricas observadas. El dossier incluye competencia/precios, GTM, entrevistas, fuentes, riesgos, lista semilla y modelo de36meses.

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
- `orchestration/autoloop.py` y `publisher.py`: supervisor acotado, revisión independiente y merge/push del SHA verificado.
- `apps/web/`: scaffold y Auth local aceptados; no sustituyen las ocho vistas y acciones completas.
- `supabase/migrations/0001..0004` y `packages/platform/src/db.ts`: identidad y schema tenant-aware aceptados localmente con SQL/Auth/Storage/retrieval y pruebas adversarias.
- `tests/controller/`: 110 tests unitarios/integración, Git real y CLI simulado; incluye rechazo posterior a revisión, ignorados/modos, presupuestos y preservación de logs. E00 tuvo además una vuelta real Astra/Codex aceptada, sin patch. El recorrido actual y sus límites se registran en [evidencia de construcción](construccion/EVIDENCIA.md).

```bash
cd ~/vexa
npm test
npm run test:controller
npm run graph:check
```
Node >=22 y Python3, sin instalar dependencias para kernel/controlador. Grafo v4 con60tareas:13gates presentes,47pendientes (escritura/revisión justo antes del incremento; presencia no significa PASS). Las pruebas de runtime necesitan entorno real de ensayo. No hay proceso autónomo de producción corriendo.

## Bloqueos que no puede inventar un agente
Acuerdo/NDA/DPA, derechos y muestra real Senix; responsables/fecha migración; Supabase cloud, Google OAuth y presupuesto OpenRouter/infraestructura; gold humano y validación de negocio. Auth/RLS locales ya están aceptados; ingesta/UI y demás módulos siguen su integración y aceptación por alcance. GitHub privado, proyecto Vercel vacío y Supabase local ya se crearon; eso no es un deploy. El 30% no equivale a sociedad formalizada y un gasto sintético no equivale a ahorro real.
