# F08-04 · Control externo de materiales y permisos

Verifica los bytes del paquete que el operador revisó, sus clasificaciones, el alcance y la vigencia de documentos externos. No publica, firma, envía mensajes ni importa código del candidato. No deduce el consentimiento del contenido de un PDF ni convierte un JSON, nota, hash, NDA o acceso CRM en autorización del titular. Tampoco analiza leyes ni sustituye el cotejo de la persona autorizada.

## Antes de ejecutar

1. Preparar un directorio dedicado con **todos** los archivos que se mostrarán o distribuirán: deck, imágenes, video, anexos y fuentes incorporadas. Usar una copia de los artefactos públicos ya existentes cuando corresponda (`docs/entrega/demo-script.md`, `demo-backup.webm` y su manifiesto); preservar sus hashes, rótulos y límites. No regenerar el video ni introducir datos de cliente. Un archivo fuera de este directorio no forma parte del resultado: no distribuirlo amparándose en este recibo.
2. El operador coteja visualmente cada archivo final, incluyendo fotogramas, notas, citas, tablas y archivos embebidos. Identifica nombre, logo, datos, caso, citas y métricas de terceros. El control **no puede detectar automáticamente una clasificación mentirosa u omitida**. Archivos comprimidos/containers se inspeccionan visualmente con su aplicación; su hash liga todos sus bytes. No ejecutar código de un candidato para inspeccionarlo.
3. Para cada material identificable, el operador consulta el consentimiento escrito original, verifica titular/facultad, derechos, condiciones, propósito, audiencia, canales, territorios, fechas y revocación. Guarda **copias de evidencia autorizadas** fuera del candidato y Git público; los originales privados siguen inmutables. Un NDA de acceso nunca ocupa el lugar de un consentimiento explícito de publicación. Si falta permiso, excluir el asset o usar VEXA y datos SYN rotulados. No inventar una aprobación para probar el recorrido real.
4. Cotejar cifras y claims con sus fuentes: escenario y forecast no son tracción; oferta del 30% no es participación firmada, y socios propuestos no son sociedad acreditada. Causalidad/ahorro no medidos no se presentan como resultado. El fixture público 300 USD/15 USD conserva métricas distintas, procedencia y carácter sintético. La clasificación `observed` exige documento fuente revisado, pero el hash no demuestra veracidad ni causalidad.
5. El operador crea el manifiesto privado y la revisión privada, ambos archivos regulares **0600** fuera del candidato. La referencia de aprobación procede de la decisión real guardada por el supervisor, nunca de un ejemplo ni del candidato. El supervisor debe cotejar que los booleanos del registro describan actos realizados. El código sólo comprueba la vinculación resultante.

## Contrato de entrada

No hay plantilla pública rellenada con falsos consentimientos. Los fixtures ejecutables de `control.test.mjs` usan exclusivamente documentos y personas SYN para probar el código; no son registros aptos para un permiso real.

`VEXA_PERMISSIONS_MANIFEST` apunta a JSON `vexa-publication-materials-v1`:

- `directory`: ruta relativa de ese paquete dentro del candidato; sin `..`, symlinks ni `.git`.
- `mode`: `synthetic_vexa` o `identifiable_material`.
- `scope`: `purpose` y listas ordenadas sin duplicados `audiences`, `channels`, `territories`.
- `assets`: lista ordenada por `path` con **todos** los archivos. Cada entrada tiene `path`, `bytes`, `sha256`, `identifiers` (lista ordenada de `company_name`, `logo`, `customer_data`, `case_study`, `quotation`, `customer_metrics`), `claims`. En SYN exige `brand: VEXA`, `dataKind: synthetic`, `syntheticLabelVisible: true` y ningún identificador. Si `recorded: true`, exige `recordedLabelVisible: true`.
- Cada claim tiene `text`, `classification`, `presentedAs`, `causalSavingClaimed: false`. `scenario` exige supuestos (`assumptions`), corte (`cutoff`), fuente (`sourceReference`) y presentación como escenario. `proposal` exige `signedAgreementClaimed: false`; `synthetic_fixture` exige `commercialTractionClaimed: false`; `not_measured` conserva ese estado. `observed` exige `evidenceSha256` de una fuente revisada. Las clasificaciones/presentaciones tienen que coincidir.

`VEXA_PERMISSIONS_AUTHORIZATION` apunta a JSON `vexa-publication-review-v1`:

- `approvalReference`, `operator`, `reviewedAt`, `expiresAt` (ventana máxima 24 horas), `operation: verify_material_permissions`, `manifestSha256` de los bytes JSON exactos, y el mismo `scope`.
- Actos cotejados: `documentsActuallyCompared`, `completePackageVisuallyReviewed`, `claimsComparedToSources`, `revocationChecked`, todos `true`; `withdrawalOwner` nominal.
- `evidence`: documentos externos 0600, máximo 16 MiB, con `file`, `sha256`, `reference`, `reviewed: true` y `kind` (`explicit_publication_permission` o `claim_source`). No se extrae ni publica su contenido.
- `permissions`: exactamente una entrada por asset identificable, ninguna para SYN. `assetPath`, `assetSha256`, `rights` exactamente iguales a los identificadores, mismo `scope`, `status: approved`, `revoked: false`, `holderIdentityAndAuthorityVerified: true`, `conditions`, `conditionsChecked: true`, `approvedAt`, `startsAt`, `expiresAt`, `documentSha256` de consentimiento explícito revisado. No se acepta una fuente económica como permiso de publicación.

`VEXA_PERMISSIONS_APPROVAL_REFERENCE` debe ser la nota guardada por el supervisor y coincidir con `approvalReference`. Allowlist integrada y revisada del runner: tres claves anteriores, última derivada de la aprobación guardada, sólo en verify con `requires_approval`. El candidato y sus agentes no reciben los punteros. No exige red, claves API ni HMAC.

## Ejecución y resultados

Desde el control-plane revisado, con variables configuradas por el supervisor:

```sh
node --test tests/acceptance/F08-04.test.mjs
```

El entry importa exclusivamente el control confiable junto a él; nunca usa soporte o tests del candidato. El paquete se inventaría dos veces y se releen manifiesto, revisión y documentos para detectar cambios. Límite: 500 archivos, 256 MiB por archivo, 512 MiB por paquete, 2000 nodos y profundidad 20. La vigencia se vuelve a comprobar al terminar. Editar un asset o añadir uno exige nueva revisión y manifiesto: no reutilizar el recibo antiguo.

El informe queda en un directorio temporal 0700 externo al candidato y archivo 0600, sin nombres de titulares, contenido documental, rutas privadas o texto de permisos. `synthetic_material_binding_verified` acredita el vínculo técnico del paquete SYN. `reviewed_document_binding_verified` acredita concordancia con documentos que el operador declaró haber cotejado. **Ninguno concede permiso:** `publicationAuthorizedByThisTool`, `customerConsentProvenByThisTool`, `formalAcceptance`, `productionValidated` son siempre `false`. No declara al cliente autorizado por usar fixtures. Una publicación posterior exige confirmar que siguen siendo esos bytes, alcance, condiciones y vigencia.

`docs/entrega/publication-permissions.json` permanece como registro público de reglas y pendientes; no se transforma en consentimiento. El supervisor integró la ficha y el registro tras revisión independiente370. El control técnico está publicado; no modifica la aceptación formal del grafo ni concede permiso.

## Validación del control

```sh
node --test support/F08-permissions/control.test.mjs
```

Los negativos verifican archivos añadidos/eliminados/modificados, ausencia de paquete, nota/alcance/cotejo incompletos, vencimiento, revocación, NDA, derechos parciales, cambios de evidencia, symlinks, clasificación de escenario/propuesta/SYN, identidad camuflada como SYN, fuente observada ausente y entrada sin punteros. Trampa del examinador candidato nunca importada. Ninguna prueba usa personas/datos reales ni hace llamadas a red.
