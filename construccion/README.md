# VEXA — de la carpeta al producto, paso a paso

**Esta es la entrada única para construir.** El repositorio canónico es `~/vexa`; `Escritorio/VEXA AI` es una copia de entrega sin Git ni estado del loop. No ejecutar el constructor dentro de la copia esperando encontrar los candidatos de la original.

## Respuesta exacta: ¿qué automatiza y qué no?

El paquete trae **55 fichas**, un controlador con candidatos y pruebas externas, una ruta interactiva `prepare → verify → accept`, fixtures monetarios y una guía hasta release. **No es un botón que ya construye todo solo**: hay gates de producto por escribir, dependencias por instalar y permisos/validaciones externas pendientes. Ninguna ficha transforma esos pendientes en PASS.

En esta revisión se sustituyó el supuesto irreal de «escribir absolutamente todas las pruebas antes del primer scaffold» por un **ciclo de pruebas externo justo antes de cada incremento**. El control-plane escribe el gate específico de la siguiente ficha, demuestra su rojo, lo revisa/versiona y sólo entonces abre el candidato. El worker jamás escribe su propio examen. Esta es una secuencia de construcción guiada con puntos humanos, no una prueba de autonomía desatendida de meses.

## Leer en este orden

1. [Comparación concreta con Likida](00-COMPARACION-LIKIDA.md): alcance y brechas, sin una nota arbitraria.
2. [Arranque, comandos y reanudación](01-ARRANQUE-Y-REANUDACION.md): qué hacer desde una sesión vacía.
3. [Entorno y accesos](02-ENTORNO.md): herramientas verificadas, instalación interactiva, aislamiento y cuentas propias.
4. [Arquitectura y contratos](03-CONTRATOS.md): decisiones de implementación, DB/API/roles y ejemplos.
5. [Pruebas y programa del loop](04-PRUEBAS-Y-LOOP.md): quién prepara el examen, fallos, QA, mutación y promoción.
6. [Las 55 fichas en orden](05-TAREAS.md): un encargo específico por ID, no sólo cinco bullets de fase.
7. [Operación, release y handoff](06-OPERACION-Y-RELEASE.md): acciones finales y su evidencia.
8. [Rúbrica](07-RUBRICA.md): con qué se evalúa esta guía, no el software futuro.
9. [Evidencia y estado real](EVIDENCIA.md), [revisión inicial](REVISION-INDEPENDIENTE.md) y [correcciones](CORRECCIONES-REVISION.md). El primer veredicto no se oculta.

Versión continua para lectura: [HTML](GUIA-COMPLETA.html) y [PDF](GUIA-COMPLETA.pdf). Fichas generadas desde `scripts/construction_catalog.py` + `orchestration/graph.json`; editar esas fuentes y regenerar antes de abrir candidatos, nunca durante un gate.

## Primeros comandos — no instalan ni despliegan

```bash
cd ~/vexa
python3 scripts/guide.py audit
python3 scripts/guide.py readiness
python3 scripts/guide.py next
python3 orchestration/runner.py status
```

- `audit` comprueba cobertura/paths/entradas/dependencias. Exit 0 **no significa producto listo**.
- `readiness` sale **2 si faltan gates**. No «arreglar» ese exit borrando tareas.
- `next` muestra la ficha o la revisión/recuperación pendiente, sin lanzar modelos.
- `status` es lectura del estado local. `accepted` acredita el alcance del gate de ese ID, no el SaaS entero.

## Qué prueban las suites actuales

`npm test` corre kernel y preparación/negativos; **no todo el producto**. `npm run test:controller` prueba el controlador en repos temporales. `npm run test:scaffold` y `test:all-gates` siguen rojos mientras falta la app; se conservan, no se desactivaron. Los 47 gates ausentes se escriben bajo revisión en su turno.

Los JSON F00 son snapshots de preparación sintética, no configuración runtime ni una certificación perpetua. Permisos, cuentas y resultados reales posteriores se acreditan en los manifiestos de F07/F08, sin reescribir esos snapshots como si siempre hubieran estado listos.

## Tres carriles, una secuencia

| Carril | Quién hace el trabajo | Qué puede tocar | Qué nunca acredita solo |
|---|---|---|---|
| Control-plane | Arquitecto/revisor en sesión interactiva | contratos, catálogo, grafo, tests protegidos | calidad de producto por existir un test |
| Candidato | Codex/Astra u operador en worktree | allowlist de la ficha | editar gate, autoaprobar, acceder a clientes |
| Externo | Javier y responsables autorizados | cuentas, permisos, etiquetas humanas, piloto, publicación | que un JSON de aprobación sea una firma legal |

F00 permite cerrar **preparación sintética** con responsables del piloto pendientes; F07/F08 conservan el candado del piloto/producción. No se inventan contactos ni se reutiliza Supabase de Likida. El orden y los cambios respecto de v2 están documentados en la comparación.

## Alcance de treinta días

Días 1–2: fuentes/fixtures/gates/entorno. 2–5: scaffold/Auth/RLS/CI. 4–8: imports/cola. 6–12: conectores. 8–15: IA/evidencia. 12–18: dinero/snapshots. 15–23: producto. 22–27: QA/piloto. 28–30: release/pitch.

Son ventanas que se solapan, no 55 tareas paralelas ni fecha garantizada. Si faltan datos o accesos se puede entregar demo sintética técnicamente validada; no se la llama piloto real. El programa comercial y TAM están en [negocio](../negocio/README.md); no cambian por hacer pasar tests.
