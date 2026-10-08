# Control externo de formularios servidos

`auth-served.test.mjs` conserva los dos casos del examen histórico de `apps/web/tests/auth-served.test.mjs`: respuestas reales de Next, HTTP200, Referrer-Policy same-origin, Cache-Control no-store y30s por caso. La configuración pública sintética no autentica al visitante. Para ese HTML anónimo, exige el formulario Google con su propio method=post y prohíbe un formulario logout; admite cualquier orden de esos dos atributos. No cambia el producto.

El archivo histórico dentro del candidato6e8b2b4 queda **superseded como control**, conservado sin editar. Su corrida residual-v1 sigue **FAIL (1/2)**; no se reclasifica retroactivamente. Las60 unidades y el build de esa corrida sí pasaron, con recibos separados.

La capacidad autenticada de cerrar sesión está cubierta por el examen real `support/F07-security/http-extra.test.mjs:224–238`: click en botón desdeoverview autenticado, solicitudPOST /auth/logout,303,Clear-Site-Data,cookies eliminadas,replay de cookie antigua401 y sesión ajena preservada. Recibo fase2: `docs/entrega/FASE-2-SEGURIDAD-2026-10-07.json`, componente http-extra8/8, logSHA4647c4890de65267aa9471b829aa9eaad6204d13e23674fffc42e5ea53de6eaa. Esa prueba no se sustituye por este control anónimo ni acredita Google externo.

La ejecución nueva instala/builds sólo en scratch propio desde el candidato congelado. **Overlay explícito:** copia este test a `scratch/apps/web/tests/auth-served.test.mjs` y `auth-form-oracle.mjs` junto a él. El recibo debe conservar hash del test original antes de sobrescribir únicamente el scratch, hashes de ambos controles ejecutados y fingerprint/HEAD del candidato antes/después. No copiar el overlay al candidato ni regenerar su manifiesto; este soporte externo no integra las fuentes del build de capacidad. Registrar identidad del control externo por hashes, separada del SHA6e8b2b4 del producto.

Calibración ligera: `node --test support/F06-final-base/auth-form-oracle.test.mjs`. Luego sólo repetir los dos casos servidos tras build necesario; no repetir las60 unidades verdes. Preparación no equivale a ejecución ni aceptación formal.
