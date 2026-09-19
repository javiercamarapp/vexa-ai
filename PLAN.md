# VEXA — investigación y construcción verificable

## Ampliación activa — construcción guiada comparable a Likida
Solicitud: comprobar y completar el paso a paso para construir VEXA en loop de punta a punta. No equivale a desplegar el SaaS en esta sesión.

Criterio de cierre de esta ampliación:
1. Comparación documentada de los planos de construcción, reanudación, QA y automejora de Likida; citas de archivo/línea y límites del contraste.
2. Un punto de entrada y una ficha específica por tarea del grafo: inputs, contrato, archivos, pasos, comandos, resultados esperados, pruebas adversarias, recuperación y quién desbloquea cada dependencia.
3. Separar trabajo del control-plane, worker offline y operador con accesos. Detectar automáticamente gates ausentes/allowlists imposibles/dependencias circulares; no fabricar PASS.
4. Herramientas locales de diagnóstico y preparación probadas con casos negativos. Un piloto sintético de los pasos ejecutables; sin credenciales reales ni publicación.
5. Revisión con contexto limpio contra rúbrica previa; correcciones, evidencia y copia al Escritorio sin pisar cambios del usuario.

Nivel: cadena guiada sobre el controlador existente, no otro framework de agentes. Presupuesto de este bloque: hasta 90 min; 2 invocaciones iniciales Codex/Astra (builder y revisor limpio) más 1 pasada correctiva acotada tras reproducir H1/H2/H3; máximo total 3, concurrencia 1, sin APIs de inferencia pagadas. No se amplía a construcción del SaaS. Principal escribe guía/contratos/herramientas; revisor sólo su reporte. Reductor: principal confronta hallazgos con reproducción y conserva los bloqueos reales. No hay autorización implícita de cloud, datos Senix o producción.

### Cierre del presupuesto del bloque
Se agotaron las tres invocaciones permitidas. La segunda revisión detectó H2b; el principal lo reprodujo y corrigió con cuatro regresiones adicionales. No se lanza una cuarta revisión ni construcción SaaS. El cierre/verificación/copia prolongó la ventana prevista de 90min; no se presenta como cumplimiento de un deadline estricto. La falta de revalidación independiente del último parche se deja explícita.

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
