# F07-03 — recuperación y caos del núcleo durable

Se integran diez archivos exactos de la propuesta359, incluido el informe original. El campo pendiente de revisión de ese informe conserva su corte de autoría; esta nota añade la revisión posterior sin reescribir los resultados.

El autor ejecutó once escenarios, tres veces con semilla42:33/33 en Node26, con PostgreSQL/Auth/Storage/Next y worker locales reales. El transporte LLM es SYN en proceso; su timeout conserva el costo incierto. El primer fallo del control de presupuesto quedó registrado y corregido antes de la corrida verde. La versión posterior del ejecutor añadió guardas de carpeta, adaptación del harness y tiempos máximos:3/3 controles en Node22 y3/3 en Node26, sin atribuirle otra corrida completa de33.

El principal revisó la composición actual, compilación y lint incluidos, y repitió dos casos con oráculos adicionales: crash después de100filas confirmadas y recuperación de250, total350únicas/cursor350/cero pendientes; borrado confirmado, replay y nueva importación sin resurrección. La comprobación independiente del RAW observó HTTP200 y bytes originales antes de borrar, HTTP400 y cero metadatos después de purgar. Snapshot financiero y componentes permanecieron intactos. Tres negativos del CLI rechazaron carpetas existentes, iguales y alias internos antes de crear infraestructura. Las cinco instancias/redes propias quedaron ausentes y las fuentes intactas.

Revisión360 comprobó los79 archivos de evidencia de autor y principal, separando33casos originales, guardas posteriores y dos casos independientes. No repitió las pruebas ni examinó el ámbito rechazado de notificaciones. El comando reproducible y sus requisitos están en [el ejecutor](../packages/jobs/chaos/README.md).

No acredita producción, proveedores reales, recuperación gestionada ni el ámbito F06-09 excluido. F07-03 no está aceptada por el runner: falta incorporar/revisar el gate formal y cumplir su dependencia F07-02. La integración del ejecutor no modifica ese estado ni incrementa por sí sola el contador.

Manifiestos SHA256: producto af674e4e5e15cd0c6bcfedc6f47f93d02087c37e725562251bc3a13a8ee55906; autor ce2e5ee12093c63f799926ecb5ef5ae14ed22cc73eeacfdd4f10098ac84bac90; principal b3301c7b8d60d7758d8992b42fa11fc9e46f332f10d3dbca931380873ea1a7f8. Recibos completos privados; no se publican sesiones ni material de cliente.

## Control externo integrado

El launcher del grafo ya usa las pruebas revisadas desde una raíz de control confiable. El principal ejecutó el gate completo en Node22:33/33 casos, compilación y lint, con cuatro archivos de examen del candidato convertidos en trampas. Ninguno se ejecutó. Dos controles adicionales pasaron en Node22/26, y el candidato sin implementación fue rechazado antes de infraestructura. Las cinco instancias/redes se inspeccionaron ausentes después del cierre.

La revisión360 comprobó las28fuentes/evidencias y el aislamiento. Con el gate, registro y correcciones integrados, no queda programación ni ensayo local identificado pendiente para F07-03. La dependencia F07-02 y la aceptación formal del runner siguen pendientes;25aceptadas no cambia. El texto anterior conserva el corte de la publicación del ejecutor.
