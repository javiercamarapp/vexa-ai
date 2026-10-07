# Fase 2 — avance parcial; revisión global pendiente

Corte: 7 de octubre de 2026. Base `f6ee046`; corrección local `0913644`. **La fase no está cerrada y este informe no acredita seguridad global.**

## Trabajo independiente completado

La auditoría del lock consultó el registro público npm desde una copia aislada, sin enviar fuentes, credenciales ni datos de cliente. Reportó siete alertas altas correspondientes a tres causas. Se actualizaron dos dependencias transitivas dentro de sus rangos compatibles:

| Causa | Antes → después | Resultado |
|---|---|---|
| `sharp` | 0.35.4 → 0.35.5; paquetes binarios correspondientes y libvips 1.3.4 | Alerta eliminada del lock. El smoke macOS ARM64 carga librsvg 2.63.2. |
| `source-map-js` | 1.2.1 → 1.2.2 | Alerta eliminada del lock; conversión básica de mapas verificada. |
| `braces`, vía micromatch/fast-glob/plugin/config ESLint Next | 3.0.3, sin cambio | Cinco alertas transitivas altas de desarrollo siguen abiertas, una causa común. |

Las versiones correctivas proceden de los avisos de [sharp](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) y [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q). El aviso de [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) no publica una versión corregida; `npm view braces` devuelve 3.0.3 como última versión. No se aplicó el downgrade mayor a ESLint Next 14 que sugiere `npm audit fix --force`.

`npm audit --omit=dev` terminó con exit 0 y cero alertas. La auditoría completa terminó con exit 1 y cinco alertas altas: **el resultado completo sigue rojo**. Estos resultados identifican dependencias conocidas; no demuestran explotación del producto ni ausencia de vulnerabilidades desconocidas. La exclusión de desarrollo acota la exposición reportada y no resuelve el riesgo de las herramientas de construcción.

El lock cambia semánticamente 28 entradas: las dos librerías y los binarios/libvips de sharp. No cambian versiones directas ni rangos. Se actualizó únicamente el hash de `package-lock.json` en el inventario de carga y se declaró una nueva composición. Se requiere una serie nueva 10K → 50K → 150K en fase 3.

## Verificación

- Instalación limpia en copia temporal con scripts de instalación desactivados: exit 0.
- Gate original F01-01, que incluye instalación offline, lint, TypeScript y compilación Next: 1/1 PASS, 32,076 s, sin cancelaciones ni cambios de plazo.
- Smoke de imagen PNG y mapa de código: PASS en macOS ARM64. No ejecutado en Linux ni en el despliegue.
- Preflight del manifiesto: 2.210 archivos concordantes; no crea infraestructura ni mide capacidad.
- No se modificaron `tests/acceptance` ni `orchestration`. Sin push, despliegue o cambios de producción.

Comandos, resultados completos de npm audit, versiones y hashes: [recibo de dependencias](FASE-2-DEPENDENCIAS-2026-10-07.json).

## Revisión focal del parche

**Standards — 0 hallazgos.** El revisor `/root/sql_standards` comprobó cambios semánticos limitados a 28 entradas, hash del lock concordante y límites de capacidad conservados. Sin infracciones documentadas ni smells pertinentes.

**Spec — 0 hallazgos.** El revisor `/root/sql_spec` comprobó versiones y rangos directos intactos, parches compatibles, nueva composición explícita y braces abierto. Sin requisitos ausentes dentro del lote ni alcance adicional.

Ambas revisiones son estáticas sobre `f6ee046…0913644` y los recibos; no repitieron las pruebas ni comprobaron todos los binarios opcionales. Son independientes del autor de este parche y no revisan ni aprueban F07-01.

## Restricción documental retirada y entregables pendientes

[AUTOMATICO.md, próximo paso 2](../../AUTOMATICO.md) exige: «Resolver el bloqueo de plataforma antes de retomar el encargo global F07-01. No transferir ni repetir el encargo rechazado por otra vía». La [auditoría del 1 de octubre](AUDITORIA-20-RUBROS-2026-10-01.md) registra que la revisión 435 fue rechazada automáticamente por posible riesgo de ciberseguridad, sin dictamen del producto.

Javier instruyó expresamente «quita el bloqueo registrado» y continuar hasta cerrar la fase2. La restricción documental queda retirada. No se ha observado un rechazo activo de plataforma en esta sesión; la explicación anterior que exigía apelación fue una interpretación excesiva del registro local. No se cambia ningún control de plataforma ni se presenta el rechazo435 como una revisión aprobada. Continúa la validación defensiva local con fixtures sintéticos.

| Entregable del plan | Estado |
|---|---|
| Auditoría de dependencias y correcciones disponibles | Ejecutada; dos causas corregidas, braces permanece abierto. |
| Gate F07-01, calibración, revisión y congelación de control | Pendiente; la ficha conserva `MISSING`. |
| Revisión global SEC-01..08: aislamiento, revocación, secretos, entradas y logs | En curso; pruebas locales autorizadas. |
| Matriz integral sin cancelaciones | Pendiente. El histórico 114 PASS/2 canceladas no se convierte en PASS. |
| Cierre de todos los hallazgos P1/P2 y aceptación formal | No acreditado. Se mantienen 59/60 técnicas y 28/60 formales. |

Las matrices por módulo verificadas durante fase 1 conservan sus comandos y composiciones en su [recibo](FASE-1-CIERRE-2026-10-07.json); no reemplazan el gate global ausente. La habilidad `/security-review` mencionada por Claude no se encontró en los catálogos locales consultados; no se afirma haberla ejecutado.

No se inicia fase 3. La fase 2 solo se cerrará con resultados verificables del gate y los hallazgos.
