# Modelos, costos y pricing: construir con Codex no hace gratis el SaaS

Corte 2026-09-19 UTC. Tarifas de catálogo consultadas mediante GET público `https://openrouter.ai/api/v1/models` sin clave ni inferencia. Catálogo válido recibido: 446 modelos. Selección y campos preservados en `fuentes/openrouter-candidatos.json`; respuesta completa en private/. El primer intento se truncó y NO se usó; el reintento comprimido produjo JSON válido. Valores son precios listados, no factura efectiva ni garantía de endpoint/región/ZDR.

## Dos economías distintas
- Construcción: Astra mediante login ChatGPT/Codex, sujeta a límites de suscripción; no OpenRouter para coding.
- Producto: Vercel/Supabase + modelos OpenRouter por conversación/job, con presupuesto empresarial propio. No conectar el token personal de Codex al SaaS. El costo del trabajo del CTO y anotadores también existe aunque no facture tokens.

## Candidatos concretos del catálogo (no ganadores de evals)
Precios listados USD por millón de tokens, entrada/salida. `structured_outputs` figura soportado a nivel modelo; falta verificar endpoint/ruta efectiva.

| ID | Entrada | Salida | Uso candidato |
|---|---:|---:|---|
| google/gemini-3.5-flash-lite | 0.30 | 2.50 | extracción simple de alto volumen |
| openai/gpt-5.4-mini | 0.75 | 4.50 | extracción/validación alternativa |
| google/gemini-3.5-flash | 1.50 | 9.00 | casos ambiguos o síntesis |
| anthropic/claude-sonnet-5 | 2.00 | 10.00 | recomendaciones/brief y adjudicación auxiliar |
| openai/gpt-6-astra | 10.00 | 50.00 | casos difíciles de bajo volumen, no default de cada ticket |
| deepseek/deepseek-v4.1-flash | 0.15 | 0.60 | candidato sólo si política de datos/ruta y evals lo permiten |

No elegir por precio únicamente ni dar por sentado que el más caro es más preciso en tickets Senix. Fijar versión/policy, validar catálogo y reevaluar tras cambios; no usar alias `latest` sin control de regresión. Modelos :free pueden tener cuotas/políticas incompatibles; no fundamentar SLA sobre gratuidad. Embeddings requieren evaluación/modelo/dimensión aparte; esta consulta no cerró esa selección.

## Escenario de tokens (SINTÉTICO, no consumo medido)
10,000 conversaciones × 1,500 tokens entrada × una pasada y 250 salida por conversación = 15M entrada + 2.5M salida. Sólo inferencia textual, sin cache, razonamiento extra, retries, embeddings, clustering, briefs ni cargos adicionales.
- Flash-lite: 15×0.30 + 2.5×2.50 = **$10.75**.
- GPT-5.4-mini: 15×0.75 + 2.5×4.50 = **$22.50**.
- Sonnet 5: 15×2 + 2.5×10 = **$55**.
- Astra: 15×10 + 2.5×50 = **$275**.

A 150K conversaciones con ese supuesto, Astra para cada una sería $4,125 sólo en esa pasada: supera el PRO de $1,499 del PRD. No sabemos que cada conversación tenga 1,500 tokens; medir P50/P95 y conversaciones largas antes de cotizar. Routing barato→escalamiento del 10% agregaría el costo de la segunda llamada sobre ese subconjunto, no sustituye retroactivamente la primera.

## Hosting publicado observado
- Vercel Pro publica **$20/mes** y $20 de usage credit; detalle de asientos/funciones/overages/impuestos y condiciones comerciales debe confirmarse al contratar. Fuente: `https://vercel.com/pricing`, copia `fuentes/web/vercel-pricing.txt` líneas aprox.123–145.
- Supabase Pro publica **$25/mes**, créditos compute de $10 que cubren una Micro; proyectos adicionales/compute/egress/storage y otras funciones pueden subir factura. Fuente: `https://supabase.com/pricing`, copia correspondiente, bloque compute. No extrapolar $25 a tres entornos y todas las cargas.
- No se provisionó ni pagó ninguno. No declarar $45 como costo total productivo: sólo suma de dos bases publicadas, antes de otros conceptos.

## Fórmula COGS por tenant
`AI + embeddings + DB/compute asignado + storage/egress + jobs/scheduler + correo + observabilidad + soporte humano + onboarding amortizado + transacciones aplicables`.
Registrar reservas, costo reportado/estimado/desconocido por intento y factura mensual; timeout no prueba que proveedor no cobró. Alertas al 50/80/100% son propuesta configurable, no gasto autorizado. Tope duro antes de llamada y reserva de capacidad interactiva. El cliente ve uso y límites, no una factura sorpresa por reintentos internos.

## Hipótesis comercial del PRD
Starter $299/10K, Growth $799/50K, Pro $1499/150K+, Enterprise $3K–10K. Son hipótesis, no tarifas aprobadas. Si el diferencial es inteligencia económica, esconder toda esa capa fuera de Starter deja un producto commodity; evaluar un plan piloto que incluya el núcleo con límites de fuentes/volumen. Separar setup/datos y servicios Convexia del software para no maquillar margen SaaS con servicios.

## Validación de precio
Hacer 5 entrevistas con decisores de presupuesto; presentar el mismo resultado, pedir una decisión de piloto con alcance/precio/plazo. Medir coste de onboarding por cuenta, ticket promedio, nº usuarios activos, horas expertas, action rate y renovación. No cobrar por «riesgo identificado» sin evitar incentivos a inflar el riesgo. Revenue share/success fee requiere contrafactual y contrato que hoy no existen.
