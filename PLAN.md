# VEXA — investigación y construcción verificable

## Encargo
Rehacer desde las fuentes los seis audios y el DOCX; interpretar el PRD de 35 secciones compartido en la sesión; revisar Documentos Likida y repos Likida/Atiende como referencia de profundidad y calidad. Preparar investigación, diligencia CTO (oferta declarada de 30%), blueprint por fases para un pitch en un mes y ejecución agentica reanudable con pruebas. Stack solicitado: Vercel, Supabase, GitHub y OpenRouter para el producto. Construcción: suscripción Codex, modelo openai-codex/gpt-6-astra; sin llamadas adicionales a APIs pagadas para esta preparación.

## Criterio de terminación
- Seis transcripciones completas, timestamps, duración, manifiesto SHA256 y limitaciones de reconocimiento; DOCX extraído íntegramente.
- Matriz trazable audio/documento → requisito → decisión → fase → prueba.
- Investigación con fuentes leídas y fechas; separar hechos, hipótesis y datos pendientes.
- Blueprint de 30 días, contratos de datos, seguridad multi-tenant, motores financieros reproducibles, evaluación, UX, integraciones y runbooks.
- Grafo de construcción y reintentos acotados; tareas verificadas por pruebas, no por autoafirmación del agente.
- Software terminado sólo cuando CI, RLS, E2E, evaluaciones y despliegue hayan sido comprobados. Documentación terminada no equivale a producto terminado.

## Fase 0: capacidades observadas
- `whisper-cli`: /opt/homebrew/bin/whisper-cli; modelos locales ~/.cache/whisper-cpp/ggml-small.bin y ggml-tiny.bin. Transcripción local, sin subir audios.
- `ffmpeg`, `ffprobe`: /opt/homebrew/bin/.
- Extracción DOCX local con Python zipfile + XML (sin dependencias externas).
- CLIs encontrados: gh, vercel, supabase, codex, pi. Existencia no demuestra acceso al proyecto VEXA.
- Modelo de esta sesión comprobado mediante PI_PROVIDER/PI_MODEL: openai-codex/gpt-6-astra.

## Estado del plan tras esta preparación
1–3 cubiertos en el alcance documentado (referencias de repos selectivas, no auditoría total). 4 cubierto como diseño/contratos/grafo, no software. 5 controlador y pruebas locales implementados, gates del resto del SaaS pendientes. 6 kernel financiero inicial verificado; aplicación y cloud pendientes. 7 handoff y recibos en PROGRESO.md/README.md. El presupuesto de 120 minutos siguiente fue el bloque inicial, no una ejecución autónoma ilimitada ni una promesa de completar todo el producto.

## Pasos
1. Preservar y transcribir fuentes; extraer DOCX.
2. Leer transcripciones y referencias relevantes; documentar discrepancias y pendientes.
3. Investigación técnica y comercial con fuentes públicas, sin APIs de pago.
4. Escribir arquitectura y blueprint por fases, riesgos, criterios de aceptación y grafo.
5. Construir y probar harness reanudable; no arrancar ejecución remota irreversible.
6. Implementar entregables locales iniciales y verificar; continuar hasta límites reales de la sesión.
7. Handoff exacto con lo terminado, lo pendiente y comandos reales.

## Decisiones y límites
- Carpeta canónica ~/vexa, fuera de iCloud. Fuentes privadas en private/, excluidas de Git.
- Likida/Atiende sólo lectura: no copiar claves, datos de clientes ni propiedad intelectual sin revisar derechos.
- PRD prohíbe agentes autónomos de negocio en MVP: distinguir agentes que CONSTRUYEN de autonomía del PRODUCTO. Acciones externas de negocio quedan aprobadas por humano.
- Horizonte de entrega: 30 días desde kickoff confirmado; no prometer viabilidad de toda la visión futura dentro del plazo.
- Preparación secuencial con estado en disco. Primer bloque: hasta 120 minutos, 0 USD en APIs adicionales, 0 subagentes por ahora; transcripción seis archivos sin reintentos infinitos.
- No despliegue de producción, contratos, mensajes a socios ni datos Senix a terceros sin autorización específica.
