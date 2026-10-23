// Entrada apta para componentes de CLIENTE (navegador): solo módulos puros, sin pg ni node:crypto.
// `index.mjs` arrastra cfo-repository -> workspace-service/contracts (node:crypto), que webpack no empaqueta para el cliente.
export {EXPECTED_SOURCES, HEALTH, SEVERITY_LABEL} from './platform-model.mjs';
export {CFO_SHORTCUTS} from './copilot/cfo-tools.mjs';
export {PLATFORM_SHORTCUTS} from './copilot/platform-tools.mjs';
export {CFO_TOOLS} from './copilot/cfo-tools.mjs';
