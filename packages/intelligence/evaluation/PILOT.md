# Piloto: preparación técnica y evaluación offline

`pilot-cli.mjs` calcula comprensión del CEO, insight nuevo, acción con sponsor y disposición a pagar a partir de observaciones aportadas por un operador. Consume el resultado y recibo del evaluador F04 existente. No llama a modelos, CRMs ni servicios externos. Requiere Node.js22; no instala dependencias.

La autenticidad del gold, consentimiento y entrevistas requiere revisión humana externa. Un archivo con `kind: human` sólo declara su procedencia. El programa nunca concede aceptación formal ni valida producción. No cambiar `docs/blueprint/pilot-evaluation.json` a medido por ejecutar el ejemplo sintético.

## Operación con archivos privados

1. El responsable reúne gold humano independiente y autorizado, predicciones del candidato congelado y evidencia privada de las observaciones. Sigue [README.md](./README.md) para separar desarrollo/holdout y congelar el protocolo ANTES de ajustar/evaluar al candidato.
2. Ejecuta F04 conservando su registro de exposición del holdout. Las rutas siguientes son ejemplos locales; usa directorios privados existentes. No publiques los archivos de entrada/salida en Git.

```sh
umask 077
node packages/intelligence/evaluation/cli.mjs freeze \
  --dataset /ruta/privada/dataset.json --spec /ruta/privada/spec.json \
  --out /ruta/privada/protocol.json
node packages/intelligence/evaluation/cli.mjs evaluate \
  --protocol /ruta/privada/protocol.json --dataset /ruta/privada/dataset.json \
  --predictions /ruta/privada/predictions.json \
  --ledger /ruta/privada/holdout-exposure.json --out /ruta/privada/evaluation
```

El candidato y sus predicciones deben respetar las fechas/hashes de ese protocolo; no cambies timestamps para hacer pasar datos reales. F04 rechaza reutilizar el holdout para otro candidato/predicción. Un resultado F04 sintético seguirá `not_measured`.

3. Completa `study.json` con la estructura del ejemplo de abajo. Copia `evaluation_binding.dataset_id` desde `evaluation/result.json.dataset_id`. Copia los otros tres valores desde `evaluation/receipt.json.exposure.protocol_hash`, `.holdout_hash` y `.candidate_hash`. No calcules ni adivines importes o hashes. Cambiar cualquier entrada exige otra salida nueva.
4. Ejecuta el piloto. No hay subcomando; se requieren exactamente estos cuatro flags:

```sh
node packages/intelligence/evaluation/pilot-cli.mjs \
  --study /ruta/privada/study.json \
  --evaluation /ruta/privada/evaluation/result.json \
  --evaluation-receipt /ruta/privada/evaluation/receipt.json \
  --out /ruta/privada/pilot-result-001
```

El padre de `--out` debe existir y `--out` debe ser nuevo. Las entradas son archivos regulares de hasta50MB, sin symlink final. Pueden estar en modo0400: se leen sin modificarse. La CLI comprueba bytes/hashes, estado y vínculo del recibo F04 antes de crear la salida; requiere los hashes del mismo evaluador/CLI F04 instalado. Un recibo no es una firma de autenticidad humana.

Se crean directorio0700 y `result.json`/`receipt.json`0600. La salida canónica es determinista para las mismas entradas; la fecha del recibo sí cambia. stdout sólo contiene estado, hash y banderas, nunca rutas, participantes ni respuestas. Un error devuelve código1 y un código fijo sin contenido privado. Una carrera de modificación de entrada detectada falla antes de crear salida. Un directorio existente no se reutiliza ni se sobrescribe. Si falla la escritura después de crear el directorio, conserva el parcial para diagnóstico y utiliza otra ruta: sólo una ejecución completa con recibo exitoso constituye resultado.

## Ejemplo completo SYN, no entrevista humana

Este ejemplo muestra TODOS los campos. Sus hashes cero son marcadores que deben sustituirse por los valores del resultado/recibo F04 que realmente usarás, y `dataset_id` debe coincidir. Ajusta las fechas del ensayo para que cada observación sea posterior o igual a `evaluation.candidate.frozen_at`. Los identificadores `SYN-...` son ficticios. No conviertas este ejemplo a `human` para presentarlo como investigación.

```json
{
  "schema_version": "vexa-pilot-study-v1",
  "study_id": "SYN-pilot-software-example",
  "kind": "synthetic",
  "window_start": "2026-10-01T00:00:00Z",
  "window_end": "2026-10-02T00:00:00Z",
  "reviewed_at": "2026-10-02T12:00:00Z",
  "reviewer_id": "SYN-reviewer",
  "evidence_ref": "private:SYN-study",
  "evaluation_binding": {
    "dataset_id": "SYN-replace-from-evaluation",
    "protocol_hash": "0000000000000000000000000000000000000000000000000000000000000000",
    "holdout_hash": "0000000000000000000000000000000000000000000000000000000000000000",
    "candidate_hash": "0000000000000000000000000000000000000000000000000000000000000000"
  },
  "eligible_ceo_ids": ["SYN-ceo-1", "SYN-ceo-2"],
  "eligible_buyer_ids": ["SYN-buyer-1", "SYN-buyer-2"],
  "consents": [
    {"participant_id":"SYN-ceo-1","consented_at":"2026-10-01T08:00:00Z","evidence_ref":"private:SYN-consent-ceo"},
    {"participant_id":"SYN-buyer-1","consented_at":"2026-10-01T08:00:00Z","evidence_ref":"private:SYN-consent-buyer"}
  ],
  "ceo_sessions": [
    {"participant_id":"SYN-ceo-1","started_at":"2026-10-01T09:00:00Z","completed_at":"2026-10-01T09:04:59Z","comprehension_confirmed":true,"evidence_ref":"private:SYN-session"}
  ],
  "buyer_responses": [
    {
      "participant_id":"SYN-buyer-1",
      "responded_at":"2026-10-01T10:00:00Z",
      "new_insight":true,
      "sponsored_action":{"committed":true,"sponsor_ref":"private:SYN-sponsor"},
      "willingness_to_pay":{"willing":true,"amount_minor":"15000","currency":"USD","exponent":2},
      "evidence_ref":"private:SYN-response"
    }
  ]
}
```

Para datos reales, usa IDs pseudónimos y referencias privadas (1–256 caracteres alfanuméricos o `._:/@#-`, comenzando con alfanumérico), no nombres, transcripciones ni mensajes libres. Conserva la correspondencia de identidades fuera del resultado. Un participante puede estar en ambas poblaciones; no puede repetirse dentro de una población ni tener dos respuestas del mismo tipo. Las poblaciones vacías y no respondientes se conservan; no inventes respuestas para rellenarlas.

Todas las fechas deben incluir segundos y zona (`Z` o `±HH:MM`), con hasta3decimales. Inicio/fin de sesión deben estar dentro de la ventana y el fin no anteceder al inicio; revisión no anterior al cierre. El consentimiento puede anteceder a la ventana pero debe existir antes o al inicio de la observación. Las observaciones del candidato ligado no pueden anteceder a su congelación. La duración del CEO se obtiene del reloj de la sesión humana: comprensión confirmada Y duración estrictamente menor de300segundos; exactamente300 no cuenta. No uses duración de jobs, vídeos o modelos.

Acción comprometida exige `sponsor_ref`; sin compromiso debe ser `null`. WTP negativa requiere importe/moneda/exponente `null`. WTP positiva puede tener importe desconocido `null`, con unidad desconocida (`currency` y `exponent` ambosnull) o unidad declarada válida. Importe conocido es string entero no negativo (hasta1000dígitos), moneda de3mayúsculas y exponente entero0–6. `"0"` explícito y `null` son distintos. No uses Number, decimales o conversiones para importes. Una intención declarada no es ingreso contratado.

## Lectura y decisiones pendientes

- `status=not_measured`: estudio sintético; numeradores, valores y cantidades principales medidos sonnull. `synthetic_diagnostics` permite comprobar aritmética del software y está rotulado como tal.
- `status=blocked`: estudio declarado humano sin gold F04 medido o sin observaciones en alguna población requerida. Las observaciones aportadas mantienen la etiqueta `reported_from_supplied_human_study`; no constituyen aprobación.
- `status=requires_human_review`: entradas declaradas humanas, evaluación F04 human_gold medida y observaciones en ambas poblaciones. Requiere revisar autenticidad, representatividad, consentimiento, evidencia y decisiones comerciales. No significa aceptación del piloto.

Cada denominador contiene TODOS los elegibles, incluidos no respondientes. `respondents` y `missing` explicitan cobertura; no respuesta no es observación negativa. Sin denominador, `value=null`. Monedas y exponentes se agrupan por separado; `known_subtotal_minor` conserva precisión, un desconocido hace `total_minor=null`, y `combined_total_minor` siempre esnull. No se establece ahorro causal. `production_validated=false`, `formal_acceptance=false` y `release_decision=not_issued` permanecen siempre.

El recibo vincula bytes leídos, resultado canónico, código piloto y evaluador F04. Preserva entrada+recibos bajo custodia privada. Quedan a cargo del operador: consentimiento legítimo, gold/entrevistas reales, sponsor, revisión de autenticidad y decisión formal. El software de este alcance puede consumir esos archivos sin programación adicional; no ejecuta el trabajo humano que origina la evidencia.
