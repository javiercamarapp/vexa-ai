# F07-04 — medición y control externo

Tres escalas reales10K/50K/150K, en orden y sin escalar tras fallos. El examinador parte de una raíz de control confiable; usa el CLI revisado y valida su informe actual mediante control Python independiente358. No lee el informe de producto como PASS.

El preflight exige inventario completo y hashes exactos, incluidos archivos adicionales/symlinks y los nueve archivos del benchmark. Las escalas siguientes requieren la misma fuente/manifiesto; la nueva metadata no recicla el recibo medido de otra composición.

El control recontó210000filas/2100chunks/cinco archivosCSV, offsets terminales, p95, costos desconocidos y EXPLAIN. El wrapper exige las tres escalas PASS, contabilidad exacta y cleanup. Liga los cinco hashes del ejecutor, candidato y manifiesto. Las métricas son ingesta local, un consumidor; no mide inferencia ni costo comercial.

Dos fallos de control conservados: archivos adicionales no inventariados y timeout sin terminar el grupo de procesos. El helper nuevo crea su propio grupoPOSIX, marca timeout irrevocablemente, envíaTERM y escalaKILL en10s; una salida0 tardía no pasa. El timeout no acredita limpieza Docker. Pruebas independientes por runtimeNode22/26:preflight4,adapter2,lifecycle4 ylauncher tardío2. Principal:informe completo verificado y ocho corrupciones rechazadas.

La medición realNode26 corresponde a d723 más freeze3. El inventario actual añade nueve helpers de caos sin cambiar las2046fuentes medidas; su attestation es separada. Se reutiliza el CLI real+validación de informe y se prueban deltas del launcher; no se atribuye otra corrida210K al wrapper completo ni al nuevo manifiesto. Una corrida futura del gate inicia10K desde cero con el manifiesto vigente.

Revisión358: e0e2a215b2b5be65d4ccb2d6a5fa5c0e9599188ea0a5cef1312507e1071b6d74. Evidencia pública acotada en docs/blueprint/load-report.json; originales y fallos completos privados. No aceptación formal, producción ni examen del ámbitoF06-09 excluido.
