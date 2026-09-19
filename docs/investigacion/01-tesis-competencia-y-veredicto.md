# Tesis, competencia y decisión de construcción

Corte: 2026-09-18 local / 2026-09-19 UTC. Evidencia: páginas públicas oficiales descargadas, conservadas en `fuentes/web/` con URL, fecha y SHA256. Son afirmaciones comerciales de los proveedores, no resultados independientemente auditados. No se accedió a demos autenticadas ni se verificaron sus contratos/precios efectivos.

## Hallazgo principal
La premisa del PRD de que VoC tradicional entrega temas y VEXA entrega impacto/acción no basta para diferenciarse del mercado actual. Enterpret, SentiSum, Thematic, Chattermill y unitQ ya publicitan varios o todos esos pasos. Esto no mata VEXA, pero sí invalida vender el flujo genérico como una categoría inédita.

| Competidor | Evidencia oficial observada | Implicación para VEXA | No comprobado |
|---|---|---|---|
| Enterpret | `https://www.enterpret.com/`: contexto de clientes, priorización revenue/churn, close the loop; testimonio usa literalmente «revenue at risk» | Rival directo de la tesis y de la visión de grafo/contexto | Precisión del modelo, dinero efectivamente ahorrado, cobertura de garantías/SKUs |
| SentiSum | `https://www.sentisum.com/`: «what each fix is worth in dollars», auditoría de retailer, action tracker, brief CFO, MCP | Rival más cercano al mensaje propuesto y a venta consultiva; no decir que nadie cuantifica dólares | Calidad contable de anualizaciones y contrafactuales, precio efectivo |
| Thematic | `https://getthematic.com/`: revenue at risk, themes trazables, impacto, activación, revisión humana | Trazabilidad y explicabilidad son requisitos competitivos, no moat por sí mismos | ROI Forrester citado por vendor no auditado aquí |
| Chattermill | `https://chattermill.com/`: impact analysis, returns, carriers, business context, XLG servicios, agentic CX y MCP | También compite con combinación software + expertos; Convexia no es exclusividad estructural | Algunas capas figuran «Coming Soon»: no tratarlas como producto demostrado |
| unitQ | `https://www.unitq.com/`: unitQ Impact conecta feedback/behavior/business con revenue, retention y engagement | Competencia por presupuesto de calidad/operaciones | Métodos de inferencia y atribución no inspeccionados |
| Gorgias | `https://www.gorgias.com/`: helpdesk + AI con órdenes Shopify, acciones y revenue attribution | Canal/integración futura y sustituto parcial con acceso nativo a datos | No se verificó análisis causal financiero equivalente |
| Dovetail | `https://dovetail.com/`: Customer Intelligence, señales→análisis→acción, MCP/API/CLI | Alternativa de research y repositorio; no limitarlo a transcripciones | Channels/Dashboards etiquetados Beta; no asumir madurez de toda capacidad |

## Mejor versión de VEXA
Un responsable de CX/operaciones de marcas de productos físicos recibe cada semana un registro de problemas por SKU/cohorte/canal, con costos observados conciliables, supuestos auditables y una acción concreta. Convexia aporta acceso y capacidad operativa para ejecutar, si tiene autorización y una relación real con el cliente. La migración HubSpot→Zendesk permite probar continuidad de la inteligencia sin sustituir el helpdesk. El comprador paga porque la evidencia cambia una decisión que antes tomaba mal o tarde, no por un chat más.

## Cuatro ataques
1. **Supuesto central:** los tickets pueden enlazarse con pedidos, garantías/refunds y acciones. Hoy no hay export para probarlo. Si el join falla, todavía hay análisis de texto, pero se debilita la promesa financiera.
2. **Competencia:** sí existe. Los siete sitios leídos bastan para rechazar una afirmación de novedad absoluta; no bastan para saber cuál gana con Senix.
3. **Costo escondido:** historia migrada duplicada, body de mensajes vs objetos ticket, clientes anónimos de marketplaces, costos de reemplazo, permisos de datos, evaluación humana y mantenimiento. Tokens ilimitados no resuelven esos dependientes externos.
4. **Oportunidad:** un mes de CTO aquí compite con ejecutar Likida y Atiende. No conocemos ingreso marginal ni horas comprometidas de esos proyectos: no inventar un costo monetario. Reservar responsabilidades/horas por escrito y exigir evidencia de piloto en semana 1.

## VEREDICTO: CAMBIAR
Construir la versión de 30 días, pero cambiar de «plataforma agéntica universal que lo automatiza todo» a **inteligencia económica de posventa de productos físicos, verificable y portable entre CRMs**. Mantener la visión larga como expansión posterior.

## Causa de muerte más probable (hipótesis)
«Murió porque el dashboard mostraba dólares convincentes que el cliente no podía conciliar ni atribuir a una acción». Para evitarlo: demostrar sobre una muestra autorizada que las cifras tienen origen y que al menos una recomendación mueve una decisión real; cuando falta información mostrar desconocido, no estimaciones arbitrarias.

## Experimentos de primera quincena
- Revisar 100 conversaciones estratificadas, con un operador real; medir cuántas enlazan a orden y costo. Registrar cobertura, sin inventar un umbral universal de aceptación: el sponsor acuerda qué decisión puede tomar con ella.
- Comparación ciega: analista humano con hoja de cálculo vs VEXA con las mismas fuentes y límite temporal. Juez evalúa descubrimiento nuevo, claridad, exactitud y acción.
- Intentar refutar tres problemas principales: ¿es sólo pico de ventas? ¿doble importación? ¿cambio de etiquetas al migrar? ¿contactos repetidos del mismo cliente?
- Mostrar una ficha con importe observado, escenario modelado y acción; preguntar qué haría diferente y si autoriza intervención. No contar «me encanta» como compra.
- Entrevistar otros dos negocios fuera de Senix para detectar sobreajuste. No usar datos Senix para entrenarlos.

## Mercado: método sin TAM fabricado
El ICP de $10M–$100M y 10K–500K interacciones/mes es hipótesis del PRD. Volumen de tickets, no facturación sola, condiciona costo/valor. Contar marcas elegibles por país, categoría, helpdesk y operación activa; deduplicar matriz/marca; documentar fuente y fecha. SAM exige acceso comercial y capacidad de soporte. SOM debe salir de capacidad comercial: cuentas abordadas × tasa de reunión × piloto × cierre × ACV; las tasas siguen sin medir. No publicar una cifra «multimillonaria» a partir del entusiasmo del audio.

## Pendientes de investigación
Demos comparadas y cotizaciones de los cinco rivales directos; casos independientes de retención/revenue; TAM por fuentes de empresas verificadas; disposición a pagar; contratos de acceso. No se han completado y no se suplirán con investigación fiscal de Likida, que es otro mercado.
