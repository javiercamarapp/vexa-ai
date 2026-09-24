# Control externo F08-01

El gate compara un manifiesto privado con un inventario nuevo del checkout limpio, usa sólo el módulo del controlador confiable y consulta por HTTP `/api/health/version` del origen HTTPS autorizado. No ejecuta código de examen del candidato. Comprueba SHA completo, archivos/hash, orden de migraciones, variables revisadas, responsables y referencias exactas de proyectos. Vuelve a comprobar fuente y vigencia después de la red. READY, HTTP200 genérico, una referencia escrita o un manifiesto editado no bastan.

El supervisor debe comprobar primero la aprobación legítima y los artefactos independientes. El manifiesto se genera con `packages/release/manifest.mjs` y se completa en un archivo privado0600 fuera del candidato. No poner secretos en sus campos. Cada variable debe tener `required_in_target` booleano y, si es requerida, `rotation_owner`; cada rol de `owners` requiere responsable. `destination` fija environment preview/production, origen HTTPS exacto, supabase_project_ref, vercel_project_id y operator_verified. Las verificaciones del titular se registran, no se inventan mediante este programa.

Cada entrada de `evidence` (`independent_review`, `critical_findings`, `restore_drill`, `local_regressions`, `remote_smoke`, `remote_served_sha`, `production_authorization`) debe contener `{file,sha256,reference}`. `file` es ruta absoluta a un JSON0600 fuera del candidato. El contenido del documento es evidencia revisada por el supervisor; el control verifica su hash, no convierte un JSON en prueba de que se ejecutó SQL, smoke, restore o una decisión humana. `production_authorization` registra la autorización del destino explícito; un preview no da autorización para promover a producción.

El JSON privado de autorización usa:

```json
{
  "schema":"vexa-release-verification-authorization-v1",
  "operator":"<responsable real>",
  "approvalReference":"<referencia comprobada por el supervisor>",
  "expiresAt":"<UTC, máximo24h>",
  "environment":"remote-authorized",
  "operation":"read_release_identity",
  "origin":"https://<destino aprobado>",
  "targetEnvironment":"preview",
  "releaseSha":"<40hex>",
  "supabaseProjectRef":"<ref propio>",
  "vercelProjectId":"<proyecto propio>",
  "projectRefsVerified":true,
  "separateEnvironmentVerified":true,
  "evidence":{
    "independent_review":{"sha256":"<64hex>","reference":"<referencia revisada>","reviewed":true}
  },
  "reviewCoverage":{
    "sourceSha":"<mismo40hex>","entireRelease":true,
    "openP0":0,"openP1":0,"criticalTestsOmitted":0,
    "excludedScopes":[],"reviewer":"<revisor>","implementer":"<autor distinto>"
  }
}
```

Completar las siete entradas de evidence: el ejemplo sólo muestra una para describir el contrato. No usar estos marcadores ni los fixturesSYN como aprobación. Un ámbito excluido o prueba crítica omitida bloquea aceptación global; no declarar `entireRelease:true` para una revisión parcial. En particular, el informe acotado actual de20rubros no satisface ese campo.

Antes de `runner.py verify --task F08-01`, el supervisor establece `VEXA_RELEASE_MANIFEST` y `VEXA_RELEASE_VERIFICATION_AUTHORIZATION` con rutas privadas y entrega `--approval-note` con la decisión real verificada. El runner deriva `VEXA_RELEASE_APPROVAL_REFERENCE` de esa nota, no de una variable arbitraria. Workers y auto-run no reciben estas entradas. Para prueba manual controlada se requieren también `VEXA_CANDIDATE` y la referencia cotejada. Ausencia de entradas falla cerrada antes de red.

Salida: carpeta nueva0700 con report.json0600, hashes y SHA observado; nunca contenido de artefactos, cookies ni claves. Red: GET único, sin cookies ni redirects, timeout10s y máximo16KiB, comprobación de caducidad antes/después/durantelectura. No ejecuta despliegues, SQL ni smoke; F08-02 ejecuta el flujo. `verified_binding` no es aceptación formal ni producción validada. Node22/26 y las negativas locales prueban el control; falta el destino real y revisión independiente del control para adoptarlo.
