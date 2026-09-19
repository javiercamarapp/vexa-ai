# F01-04 — propuesta de examen externo; NO congelada ni aceptada

Autoría 2026-09-19. Sólo se escribieron F01-04.test.mjs y este directorio. No se modificó producto, migraciones, grafo, orchestration, Auth previo ni Git. No se leyó private/. Sin delegación. SHA Git no consultado por prohibición explícita; revisión/control-plane debe registrar baseline_sha y candidate_sha antes de congelar. No hay reviewer independiente en esta sesión.

## Comandos y resultados

Desde la raíz del examen:

```sh
VEXA_CANDIDATE="$PWD" node --test tests/acceptance/F01-04.test.mjs
VEXA_CANDIDATE="$PWD" node --test tests/acceptance/support/F01-04/probe.test.mjs
```

- Gate sobre baseline: exit 1, `IMPLEMENTATION_MISSING: DataState`, 1 fallo, 0 skips. `absence-result.txt` conserva salida. No es un error de instalación ni de Docker.
- Probe de componentes de la propuesta permitida, montados en copia temporal del scaffold: exit 0, 4 tests, 0 fallos, 0 skips, 44.3 s en la primera corrida completa. Control positivo antes y después de mutar. `probe-result.txt` conserva la repetición final.
- Mutantes en archivos TSX reales temporales: sustituir rama error por vacío → `ERROR_VISIBLE`; eliminar query del Link → `SCOPE_PRESERVED`; añadir `tabIndex={-1}` a los seis Links → `KEYBOARD_NAV`. Sólo cuentan fallos de estas aserciones, no errores de setup/compilación/timeout. El probe nunca es aceptación del candidato.
- Incidencias previas preservadas conceptualmente: Next dev encontró EMFILE; se corrigió harness con WATCHPACK_POLLING=500. Imagen contiene Chromium completo, no headless_shell; se fijó ruta instalada `/ms-playwright/chromium-1226/chrome-linux/chrome`. Se corrigió espera de navegación usando waitForURL en vez de 300 ms. Ninguna incidencia se contó como mutante muerto.

Primera evidencia completa temporal: `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-f01-04-ZjKkV1`. Copias persistentes de doce capturas: `evidence/390-{estado}.png` y `evidence/1440-{estado}.png`. Capturan el montaje de componentes, NO ocho páginas terminadas. Inspección visual del autor: 390-error.png. No se hizo revisión visual independiente.

## Alcance e interfaces explícitas de la propuesta

`VEXA_CANDIDATE` obligatorio, sin fallback al baseline. Inputs reales: DataState/Navigation exportados, primero `components/workspace/`, alternativamente `components/`; props de la propuesta autorizada. DataState usa union kind loading/empty/error/partial/stale/ready. Ruta de montaje `/exam-f01-04` creada sólo en temporal: pasa props sintéticos y children, importa componentes reales; no implementa estado, enlaces ni autorización. No se exige workspace-service, dinero, asignación, inferencia ni features F06.

Se verifican DOM y acciones con Chromium real: seis enlaces, alcance repetido SKU/source y moneda/fechas/base/snapshot conservados, cursor retirado, Tab/foco visible/Enter, alert y reintento, status/busy, ausencia de hijos ready en loading/empty/error, cobertura/corte visibles, partial/stale distinguibles, reduced-motion y overflow a 390x844 y 1440x900. Screenshots no sustituyen aserciones. La suite de componentes usa estilos reales del candidato/scaffold.

`routes.mjs` propone el circuito separado de rutas reales `/overview`, `/problems`, `/recommendations`, `/explorer`, `/interventions`, `/briefs`, más `/problems/:id` y `/customers/:id` desde enlaces de registros propios. Browser prueba acceso directo anónimo, positivo autenticado, query tenant_id forjada, cookie selector ajena y positivo posterior; el menú no es oráculo de autorización. Incluye URL inválida/duplicada y error visible. No reemplaza sesiones ni funciones Auth del producto: signup real en Auth efímero, cookie SSR con token realmente emitido. No reejecuta Google/PKCE ni modifica el gate Auth previo.

Fixtures mínimas propuestas usan organizaciones/membership y customers/problems/connections/conversations/problem_conversations del contrato F01-03. Se aplican migraciones del candidato sólo en DB efímera. No se crea schema sustituto. Una incompatibilidad de fixture es SETUP, nunca vulnerabilidad ni mutante detectado. Ajustar binding externo con revisión antes de congelar, sin cambiar expectativas ni exigir backend fuera de allowlist.

## Aislamiento y ejecución

npm ci --offline --ignore-scripts --no-audit --no-fund sólo en temporal. Copia excluye .git/.env/private/node_modules/.next/.runtime y rechaza symlinks. Next usa entorno permitido sin secretos heredados. No ejecutar este gate en paralelo con otro que use sus puertos. Puerto ocupado falla, no se reutiliza servidor ajeno.

Chromium: imagen LOCAL `8771dc4666e7`, Docker --pull never, contenedor UUID propio; no browser nativo. Next escucha 57560; proxy Auth/REST propio 57564, servicios propios Auth57561/Storage57562/REST57563. PostgreSQL no publica puertos. Servicios se derivaron del harness F01-03 en una copia de soporte con UUID propio y puertos cambiados; nunca se importa/ejecuta el harness antiguo ni se accede a vexa-local/5632x/5744x/5751x/5753x. No imágenes descargadas, API/cloud ni envíos. Browser bloquea destinos distintos de la app propia. Teardown sólo recursos UUID creados por la corrida. Temporales conservan logs/capturas; sesiones son exclusivamente sintéticas.

## Pendientes que impiden congelación

1. Validación independiente requerida y no realizada; no autoaceptación.
2. Circuito de ocho rutas/Auth/fixtures NO ejecutado: baseline carece de componentes/rutas. No atribuirle PASS por el probe. Validar cookie SSR, binding de registros/fichas y selección forjada contra candidato real. El harness no fabrica páginas ni datos ready para hacerlo pasar.
3. Teclado/foco comprobado en navegación, no todas las acciones/formularios del futuro shell; ampliar revisión y oráculos de acciones cuando exista la UI, antes de congelar. Contraste, lector de pantalla real, foco tras transiciones/error y selección de filtros por formulario no acreditados.
4. Estados ejercitados sobre componente real en montaje; no acreditan propagación de un error SQL hacia cada una de las ocho vistas. El mutante error→vacío afecta el componente, no un repositorio de datos. No afirmar cobertura SQL/UI completa.
5. No build de producción, F06, export, dinero, inferencia, servicios remotos ni SaaS terminado. No se ejecutaron suites generales ajenas al cambio.

El resultado es una propuesta con rojo de ausencia y mutación real reproducibles, no un examen listo para promoción mientras existan estos pendientes.
