# Rovaq AI: marca e interfaz de administración

La administración de plataforma usaba el contenedor de acceso de620px, apilando creación, organizaciones y actividad. Ahora comparte navegación lateral y marco amplio con el workspace; organizaciones y alta se distribuyen en paralelo en escritorio y se adaptan a móvil.

Importaciones, conexiones, histórico, equipo, retención, evaluación, análisis, notificaciones y aliases reciben composiciones por tarea con columnas responsivas. El acceso conserva su imagen local aprobada y distribución dividida. La marca pública pasa a Rovaq AI en páginas, metadatos, notificaciones, manifest e icono tipográfico, más las plantillas locales de Auth. Identificadores técnicos, variables de entorno, rutas y contratos permanecen estables.

## Comprobaciones

- Lint, typecheck y build Node22 en copia aislada sin harness visual.
-15 pruebas de plantillas Auth: contenido exacto, marca, enlaces y tokens preservados.
- Revisión independiente del delta:615 atributos de comportamiento/validación/foco originales conservados; sin cambios de Auth, RLS o fetch.
- Revisión visual local de login en Chrome/Safari y administración/importaciones mediante fixtures rotulados. Las fixtures nunca se incluyen en el despliegue.

## Límites

La modificación de plantillas locales no aplica por sí sola su configuración al proveedor Auth. El cambio de marca de la interfaz no renombra automáticamente organizaciones existentes ni cambia el dominio. La carga de datos de un cliente requiere su organización y membresías legítimas; preparar archivos o compilar la interfaz no acredita esa carga. No se declara un nuevo resultado de capacidad ni aceptación formal de60/60.
