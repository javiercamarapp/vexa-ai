# Entorno de F01-01

La aplicación inicial no necesita variables de entorno ni archivos `.env`.
No conecta servicios externos. Usa fuentes del sistema; el build no descarga fuentes.
`/api/health/version` informa la versión de este paquete; `revision: null` indica que
no se ha incorporado un SHA de publicación. No certifica disponibilidad de servicios.

## Toolchain

Versiones verificadas en registry.npmjs.org el 2026-09-19: Next 16.3.5,
React/React DOM 19.3.0, TypeScript 5.9.3 y ESLint 9.39.4.
Next declara Node >=20.9 y React ^19 compatible; este proyecto exige Node >=22.
Vercel prevé Node 24, pendiente de validación allí. eslint-config-next 16.3.5
acepta TypeScript >=3.3.1; se fija TS 5.9.3 y se verifica mediante typecheck/build.
Todas las dependencias directas tienen versión exacta y el lock fija las transitivas.

## Ejecución en copia temporal

Copiar únicamente package.json, package-lock.json, apps/ y packages/ a una carpeta
propia bajo /tmp, sin node_modules ni artefactos. Desde esa copia:

```sh
npm ci --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org
npm run lint --workspace apps/web
npm run typecheck --workspace apps/web
NEXT_TELEMETRY_DISABLED=1 npm run build --workspace apps/web
npm run start --workspace apps/web -- --hostname 127.0.0.1
```

Después de primar la caché, `npm ci --offline --ignore-scripts --no-audit --no-fund`
reproduce la instalación sin red. El build usa webpack explícitamente.
`dev` inicia Next en desarrollo; `start` requiere build previo.
No ejecutar instalación/build en el candidato: generan node_modules, .next y
archivos incrementales. No hay Auth, Google, RLS, conectores ni despliegue implementados.
