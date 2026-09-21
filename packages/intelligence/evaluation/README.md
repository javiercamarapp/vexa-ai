# Evaluación temporal reproducible

Herramienta local del evaluador externo. No ejecuta modelos, no accede a cloud, no exporta datos automáticamente y no autoriza releases. Requiere Node 22 o posterior; no necesita dependencias. No hay gold humano incluido. El archivo `docs/blueprint/evaluation-protocol.json` es una plantilla de política, no un protocolo de una medición real.

## Flujo operativo

1. El responsable autorizado prepara datos redactados y minimizados fuera del checkout y del entorno del worker. No use claves, PII ni mensajes de producción sin autorización.
2. Deduplica casos, grupos canónicos y clientes. Asigna cada cliente/grupo completo a un único split. Train/dev deben ser anteriores al corte, incluso `available_at`; holdout debe ser posterior. Todas las fuentes ya deben estar disponibles al congelar. Revisiones que crucen el corte requieren una cohorte separada, no una excepción silenciosa.
3. Dos humanos independientes anotan cada caso holdout a ciegas. Un tercer humano distinto adjudica desacuerdos y conserva las dos anotaciones originales. El responsable adjunta la referencia de revisión humana real. No copiar las identidades ficticias de pruebas como firmas.
4. El evaluador congela dataset, taxonomía, corte y objetivos **antes** de ajustar prompts/modelos. Mantiene protocolo, holdout y ledger de exposición en una carpeta privada inaccesible al worker.
5. Sólo entrega al worker el resultado de `export-dev`. El worker ajusta sobre desarrollo y entrega un candidato congelado. Un ejecutor externo produce predicciones holdout sin devolver casos o etiquetas al worker. Esta herramienta evalúa predicciones ya producidas; no implementa ni autoriza inferencia.
6. El evaluador ejecuta una vez por holdout/candidato. Ledger conserva la exposición: repetir exactamente los mismos inputs permite reproducibilidad, cambiar candidato o predicciones con el mismo ledger se rechaza. Tras usar resultados para ajustar, hace falta un holdout nuevo. No borrar, cambiar o crear otro ledger para eludir esta regla; el directorio externo es un control operativo, no una barrera contra el propietario del sistema.

Comandos, desde la raíz del checkout y con rutas absolutas privadas:

```sh
node packages/intelligence/evaluation/cli.mjs freeze --dataset /private/eval/dataset.json --spec /private/eval/spec.json --out /private/eval/protocol.json
node packages/intelligence/evaluation/cli.mjs export-dev --protocol /private/eval/protocol.json --dataset /private/eval/dataset.json --out /private/eval/development.json
node packages/intelligence/evaluation/cli.mjs evaluate --protocol /private/eval/protocol.json --dataset /private/eval/dataset.json --predictions /private/eval/predictions.json --out /private/eval/run-001 --ledger /private/eval/holdout-exposure.json
```

Las carpetas padre deben existir. La salida nueva no puede existir: archivos con `wx` y modo 0600, directorio de corrida 0700. No se sobreescriben inputs ni resultados previos. Inputs deben ser archivos normales, no symlinks, con máximo 50 MB por archivo. JSON inválido, hashes incorrectos o fuga temporal fallan con exit 1 y un código sanitizado. Exit 0 sólo significa que el comando produjo un artefacto; `not_measured` no es aprobación. El resultado no contiene textos de mensajes; tiene métricas y referencias pseudónimas. Aun así se mantiene privado.

## Entrada exacta

`spec.json`:

```json
{"protocol_id":"ID-ASIGNADO-POR-EVALUADOR","taxonomy":{"version":"VERSION-CON-GELADA","labels":["entrega","calidad","otro"]},"cutoff":"FECHA-ISO-REAL"}
```

`dataset.json` tiene `dataset_id`, `kind` (`synthetic`, `silver_assisted` o `human_gold`) y `cases`. Cada caso contiene:

- `id`, `client_id` pseudónimo, `group_id` canónico y `split` (`train`, `dev` o `holdout`). IDs únicos; clientes y grupos no cruzan splits.
- `event_time`, `available_at`: fechas ISO. Disponibilidad no puede preceder al evento ni exceder el freeze. Datos desarrollo disponibles después del corte se rechazan.
- `messages`: `{id,client_id,text,authorized,hash}`. `text` ya está redactado; `hash` es SHA-256 de sus bytes UTF-8; `client_id` debe coincidir con el caso. `authorized` es la declaración del custodio de acceso vigente, que esta herramienta offline no puede consultar en un servicio real.
- `content_hash`: `hashValue(messages)` usando el export del módulo. Detecta alteración; la deduplicación entre splits usa además hashes de texto sin IDs, para que renombrar clientes/mensajes no evada el control.
- `annotations`: `{annotator_id,annotated_at,kind,blind,labels}`. Gold exige exactamente dos anotadores distintos, `kind: human`, `blind: true`, fechas anteriores al freeze y labels de taxonomía. Synthetic/model nunca se promueven a gold.
- `adjudication`, sólo si hay desacuerdo: `{adjudicator_id,adjudicated_at,reason,labels}`. Humano distinto, fecha posterior a ambas anotaciones y anterior al freeze.

Gold humano también exige `gold_attestation: {reviewer_id,reviewed_at,evidence_ref,human_review_confirmed:true}` en dataset. El código valida estructura y fechas, no puede certificar que una persona realmente anotó. La autenticidad queda para auditoría humana externa; no hay firma criptográfica o autenticación que no exista. Un dataset sintético o silver, gold incompleto o sin atestación devuelve `status: not_measured` y `classification.per_class: null`, aunque coincida perfectamente con un stub. Sus diagnósticos operativos sólo prueban software.

`predictions.json`:

```text
{
  protocol_hash: hashValue(protocol),
  holdout_hash: protocol.holdout_hash,
  candidate: {id, prompt_hash: SHA256, code_hash: SHA256, tuning_started_at, frozen_at},
  cases: [{
    case_id, generated_at, status: succeeded|failed|rejected,
    abstained: boolean, labels: [taxonomía],
    citations: [{message_id, client_id, hash, start, end, quote}],
    attempts: [{model, provider, currency: USD, exponent: 6, cost_minor: "entero"|null}],
    latency_ms: número>=0|null,
    usefulness?: {reviewer_id, reviewed_at, topic_correct, evidence_sufficient, decision_possible}
  }]
}
```

Todas las fechas son ISO. `protocol.frozen_at <= tuning_started_at <= candidate.frozen_at <= generated_at`. `case_id` sólo puede pertenecer a holdout. No se aceptan duplicados. Fallos/abstenciones tienen `labels: []`. Faltar una predicción cuenta como falta técnica, no se elimina del denominador. Todas las tentativas facturables, incluidas fallidas, deben constar; el costo desconocido es `null`, nunca cero. Los offsets de citas usan puntos de código Unicode (`Array.from(text)`), y hash/texto exactos del mensaje. El chequeo determinista no demuestra apoyo semántico: éste exige revisión humana.

Estudio de compradores opcional, separado: `buyer_study: {kind:"human_buyers",study_id,reviewer_id,reviewed_at,evidence_ref,window_start,window_end,eligible_buyer_ids:[...],responses:[{buyer_id,new_insight,responded_at}]}`. Identidades distintas y dentro del universo elegible; ventana explícita. No respuesta permanece en el denominador conservador. No enviar este bloque sin investigación humana real autorizada. Ausencia significa `not_measured`; no se infiere de labels, costes, fixtures o utilidad de clasificación.

## Salidas y significado

`result.json` conserva hashes canónicos de inputs, candidato, conteos y métricas. `receipt.json` añade hashes de los bytes de entrada efectivamente leídos (sin releerlos al final), motor/CLI, comando real, fecha, exit code y ledger utilizado. Una repetición idéntica produce el mismo hash de resultado; fecha y marca replay del recibo cambian. Los inputs originales son read-only; conserve su custodia para auditar anotaciones, desacuerdos y fuente operacional.

Por clase se reportan TP, FP, FN, precisión `TP/(TP+FP)`, recall `TP/(TP+FN)` y F1 `2TP/(2TP+FP+FN)` con numerador/denominador. Abstenerse sobre un positivo cuenta FN. Denominador cero devuelve `null` y estado `undefined`, nunca 100%.

Cobertura usa clasificaciones emitidas/todos los casos elegibles; abstención se separa de fallos técnicos y predicciones ausentes. Citas reportan referencias válidas/emitidas y total inválidas. Coste incluye subtotal conocido y recuento desconocido; total es `null` si falta cualquier coste/caso. Latencia informa n conocidos, n elegibles y percentiles nearest-rank; no inventa tiempos para fallos sin telemetría.

Clasificación útil >85% requiere revisión humana con tema correcto, evidencia suficiente y decisión posible, denominador todas las clasificaciones emitidas. Sin revisiones, esa utilidad queda `not_measured`; con revisión parcial queda `partial`, valor principal null y límite inferior conservador explícito. No se reemplaza por accuracy o coincidencia de labels. Insight nuevo >70% usa exclusivamente compradores elegibles y su estudio separado. Ninguna de estas métricas aprueba automáticamente un release.

Este harness implementa los oráculos de F04-07; no afirma ejecutar todo el programa de investigación. No produce intervalos agrupados por cliente, calibración/Brier, evaluación humana de clusters ni disposición a pagar. Esas mediciones adicionales del protocolo de investigación siguen requiriendo datos y procedimientos propios; no se simulan aquí.
