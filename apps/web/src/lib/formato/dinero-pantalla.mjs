// Reemplazo de `formatMinorUnits` (packages/metrics/money.mjs: «803,982.16 USD») para las PANTALLAS: mismo contrato (cadena de unidades menores, moneda, exponente),
// pero con el formato único es-MX de lib/formato/es-mx.mjs («US$803,982»). null => «No disponible» (jamás 0). Los paneles de importación (que verifican centavos) siguen con money.mjs.
import {dinero} from './es-mx.mjs';
export function formatMinorUnits(amountMinor, currency, exponent) {
  if (amountMinor === null || amountMinor === undefined) return 'No disponible';
  return dinero(amountMinor, currency, exponent);
}
