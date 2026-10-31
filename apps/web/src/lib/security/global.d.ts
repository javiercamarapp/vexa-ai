export {};
declare global {
  // Publicado por lib/security/registro.ts (instalar). Los paquetes lo llaman con try/catch y `?.`.
  var __vexaSecuritySink: ((evento: import('./eventos').EventoSeguridad) => void) | undefined;
}
