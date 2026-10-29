export {};
declare global {
  // Publicado por lib/security/registro.ts (instalar). Los paquetes lo llaman con try/catch y `?.`.
  // eslint-disable-next-line no-var
  var __vexaSecuritySink: ((evento: import('./eventos').EventoSeguridad) => void) | undefined;
}
