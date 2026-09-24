# F07-03 — control externo del caos durable

El gate ejecuta once escenarios por tres vueltas, semilla42, con Auth/PostgreSQL/Storage/Next/worker reales locales. Sólo el transporte LLM es SYN. Los módulos del examinador, harness de infraestructura y seed se resuelven desde el controlador confiable; nunca se importa el examinador del candidato. El candidato suministra únicamente el producto probado.

El informe se escribe por aserciones de la ejecución actual, no se acepta el JSON aportado por el candidato. El launcher exige exit0 sin señal,33casos con inventario exacto por vuelta, snapshot inmutable,350filas únicas/cursor350/cola250, costo incierto nulo, borrado sin resurrección y limpieza real de recursos propios. Los negativos del validador detectan informe incompleto, caso sustituido, cursor incorrecto, costo0, resurrección y limpieza fallida; no se llaman mutantes del producto.

La prueba de aislamiento sustituyó cuatro archivos de controles del candidato por excepciones; el gate real pasó33casos sin ejecutarlos. Ausencia de producto falla por CHAOS_IMPLEMENTATION_MISSING antes de infraestructura. Node22 ejecutó todo el gate actual, incluida compilación/lint; Node26 conserva evidencia del ejecutor33autor y dos casos independientes, sin atribuirle otra ejecución del nuevo launcher. Los negativos del control pasaron en ambos runtimes.

Recursos exclusivamente locales propios y puertos61620–61625; no ejecutar concurrentemente otro ensayo en esos puertos. Journal exclusivo y evidencia nueva0700. Timeout del launcher solicita SIGTERM al hijo; el harness registra cleanup y su resultado se exige. No usar esta prueba sobre producción ni reinterpretar un timeout como limpieza realizada.

Revisión independiente360:8ead7834dc27027f71b2c7e26a1f268e345c456a6aa373f3d7fb7164dab6bd05. Control4fuentes:6d8a39209a865689931322e04c3e7bebfab66689bf8800d8480c4940c9a8c067. Evidencia24:1e81c55aa98bd9dc00c03a6ac4ebd163f02eb2c2a385d2017436038d35f26030. No declara aceptación formal ni examina F06-09 excluido.
