# Dinero exacto, catálogo y conversión explícita

La UI y la API comparten `money.mjs`: el formato visible es `300.00 USD`. Las cantidades monetarias son cadenas de enteros o `null`, nunca se convierten a `Number` para sumar, convertir o renderizar. Un importe desconocido conserva el subtotal conocido y la cobertura, sin presentarlo como total.

`money-adapter.mjs` proyecta los DTO camelCase del ledger a `Money` snake_case: `amount_minor`, `known_subtotal`, `coverage`, moneda/exponente, ventana, base, procedencia y estado. Acepta también un DTO `Money` ya validado del mismo tenant. El total, subtotal y cobertura se mantienen separados. Los conjuntos por problema y las familias económicas no se declaran aditivos.

El catálogo se configura desde «Catálogo monetario aprobado» en `/overview`. El propietario aporta código, exponente, fuente, referencia, fecha y evidencia revisada. La base de datos conserva cada versión aprobada y rechaza actualización/borrado directo. El ledger actual admite exponentes0..4; las funciones puras mantienen el soporte0..9. Sin un catálogo vigente para la unidad registrada, la UI muestra el original y el estado pendiente; no fabrica un DTO aprobado ni habilita conversión.

«Tipo de cambio aprobado» registra una tasa decimal exacta, su par base/destino, fuente, referencia, fecha, versión y regla de redondeo. Una unidad base equivale a la tasa indicada en destino. La tasa queda vinculada a las versiones exactas del catálogo usadas al aprobarla. Cambiar el catálogo, retirar la tasa o revocar al contribuyente invalida la conversión. No se consultan servicios externos ni se inventan cotizaciones.

Las operaciones son `POST /api/economics` con `operation:currency` o `operation:fxRate`. Autenticación, organización derivada de sesión, CSRF y propietario se verifican en servidor. Las escrituras usan versión esperada/CAS; un conflicto exige consultar y revisar de nuevo. El formulario vincula el consentimiento a los campos y versiones revisados y lo invalida tras enviar. Una retirada crea otra versión con `active:false`.

`GET /api/economics` conserva las monedas originales en `monetary.nativeBundles`, con ventanas UTC semiabiertas: inicio incluido, fin excluido. La conversión sólo se solicita mediante `fxRateId`, identificador de una versión actual autorizada elegida en «Conversión explícita». Sin selección no se convierte ni suma USD y MXN. La respuesta conserva `original`, `converted` y `conversion` con tasa, fracción exacta, fuente, fecha, versión y regla de redondeo. Una referencia antigua, ajena o revocada falla; no se sustituye por otra tasa silenciosamente.

La conversión se aplica una vez a cada agregado nativo, con redondeo exacto al exponente de salida: mitad hacia fuera de cero, mitad al par o hacia cero. No se afirma que sumar conversiones redondeadas por línea equivalga a convertir su agregado. Las cifras convertidas no reemplazan al ledger original. Exposición, reembolsos, reemplazos, soporte y escenarios siguen separados; no hay un total de pérdida inventado.

`scope.mjs` verifica calendarios, zona horaria y fin exclusivo. Para horizontes, inicio coincide con `as_of` y fin con la duración versionada. El flujo actual del ledger declara UTC explícitamente; no interpreta fechas del navegador como UTC sin indicarlo. Los escenarios siguen siendo escenarios, no pronósticos calibrados. No se publican snapshots en esta fase.

La revisión requiere pruebas independientes de exactitud, permisos, CAS, revocación y UI/API sobre hashes de código. Datos de prueba sintéticos no acreditan cotizaciones, catálogo ni aprobaciones de un cliente real.
