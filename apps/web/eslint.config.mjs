import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  // Con las rutas bajo el grupo (app) esta regla empezó a marcar los <a> de navegación completa (login, cierre de sesión, salida de raíz); antes del movimiento no detectaba esas páginas. Los enlaces entre las dos raíces deben ser <a>.
  {rules: {"@next/next/no-html-link-for-pages": "off"}},
  globalIgnores([".next/**", "next-env.d.ts", "public/vendor/**", "public/landing/**"]),
]);
