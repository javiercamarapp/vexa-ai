# Accesibilidad y estados: correcciones verificadas

Base pública `082e85b`. Ronda391–393, con autor y revisor separados por cambio. No modifica53/60 técnicas,25aceptadas formales ni `production_validated=false`.

## Dos defectos reparados

**Login:** el texto pequeño sobre la fotografía tenía contraste mínimo3,19:1 en glifos centrales, inferior al mínimo4,5:1. Una reglaCSS conserva foto, texto y tipografía y añade blanco opaco sobre un fondo verde oscuro compacto. WebKit mide15,80–17,22:1 en1024/1440/1920px. La revisión independiente en Chromium comprueba texto completo, desplazamiento vertical, ausencia de desbordamiento y una cota13,30:1 incluso sobre una imagen completamente blanca. En390px se conserva el arte oculto por diseño. El primer render1024 incompleto se conserva como fallido; sólo el focal con el texto completo acredita su contraste.

**Explorador:** tras una combinación real de problemas, la API marcaba el snapshot como `stale`, pero no había aviso global. Ahora el componente común muestra «Datos desactualizados: revisa el corte», cobertura y fecha. La revisión393 reprodujo el rojo original y pasó cinco grupos sobre la composición final: aviso único, ausencia de falso aviso en ready/partial/empty, consultaPOST200, revocación403 y recuperación200. Los importes permanecen30000/1500minorUSD; un dato desconocido conserva `null` y su subtotal conocido, sin transformarlo en cero. Lint y compilación Node22 aprobados.

## Cobertura nueva y reutilizada

| Área | Evidencia y límites |
|---|---|
| Contraste incompleto de388 | 42observaciones de controles/etiquetas visibles con contraste5,03–14,83:1. Se reutilizan dos mediciones anteriores donde corresponden; no se borran los resultados originales de axe. |
| Teclado | Seis comprobaciones focales de activación, selección nativa por letras y envíoEnter con API200. Después, las seis observaciones Tab que391 no había demostrado se recorrieron en ambos motores: cuatro destinos móviles y textarea de evidencia a390/1440px. WebKit usa Option+Tab y Chromium Tab; la diferencia se reprodujo en HTML nativo sin estilos. Hay foco visible y recorrido secuencial desde el enlace de salto. No certifica todos los controles ni lector de pantalla. |
| Ocho vistas | Nuevas pruebas de datos parciales y cortes históricos donde el contrato los define. Seis colecciones vacías; los detalles inexistentes corresponden a404, no a un vacío fabricado. Carga/error visual de388 se conserva identificado como simulación del navegador. |
| Equipo, inbox y preferencias | Carga retenida de una respuesta real para comprobar presentación; revocación SQL real403, limpieza de datos y recuperación200. Inbox de lectura no demuestra entrega de correos o push. |
| Login | Cinco controles de presentación: solicitud pendiente con prevención de duplicados, respuesta202 uniforme y espera, error503, fallo de red, correo inválido y aviso de acceso denegado agrupados en cinco casos. Las respuestas se interceptaron en el navegador; no se enviaron correos. La evidencia Mailpit/Auth373 sigue siendo histórica y distinta. |
| Medición parcial de intervenciones | Se localizó el recibo histórico14/14: reapertura, snapshot con importe desconocido, resultado parcial, cierre409 y UI «Medición parcial»/«Desconocido». Cinco fuentes del módulo y panel permanecen idénticas. No se repitió la suite ni se atribuye su resultado a una ejecución nueva. |

Se conservan los fallos de controles privados: selector de Equipo demasiado amplio, observador de desactualización que confundía una opción del filtro y búsqueda nativa por letras consecutivas. Las correcciones del ensayo tienen diagnóstico separado; no se presentan como defectos del software. `/auth/error` de388 devolvía404 y queda excluido: no acredita un estado de error del login.

## Trazabilidad

| Evidencia | SHA256 del manifiesto |
|---|---|
| Autor391,94artefactos | `1705a78ea1704e8f41027146bbbe6fac65997ab16cd27a30c7fa38a943a51a30` |
| Revisión independiente del CSS | `8076e4dcb96f3bb689f15196c688334d56ad510d9d4e91486591541d9382317a` |
| Autor392,117artefactos | `ca5e47b4527069485c53f04066ab013264e080b5fd8cb6141e5cb39a0df86ad2` |
| Revisor393,44artefactos | `9a163f4815d11333642f93b39087c48a9fba2697c02257f39bf5685443881550` |
| Recorrido Tab posterior | `fc409c06a190da12335d364932012a50e8cd9265d1376e8bc837051dd9d4e3e6` |
| Estados de login, presentación | `f80d5f5f60ab46cfd844f992681d578b4883b9a7f60c93bc61f007ef835880b0` |

Los procesos y servicios locales de esta ronda se recogieron. Esta evidencia no acredita revisión visual humana, lector de pantalla, Safari físico,582acciones ejecutadas, proveedores reales ni el ámbito de entrega bloqueado. [Siete pendientes](SIETE-PENDIENTES-2026-09-28.md). El smoke remoto completo previo conserva el SHA `b9ed3db`; publicación y verificación de estas dos correcciones se registran con su propio SHA, sin reetiquetar aquel ensayo.
