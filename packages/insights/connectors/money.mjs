// Decimal en texto -> unidades menores (BigInt-safe como texto). Nunca Number para dinero. null si no es un monto válido (jamás 0 inventado).
export function toMinor(raw, exponent = 2) {
  const t = String(raw ?? '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(t) || !Number.isInteger(exponent) || exponent < 0 || exponent > 4) return null;
  const neg = t.startsWith('-'), [i, f = ''] = t.replace('-', '').split('.');
  const frac = (f + '0'.repeat(exponent)).slice(0, exponent), round = f.length > exponent && Number(f[exponent]) >= 5 ? 1n : 0n;
  const v = BigInt(i + frac) + round;
  return (neg ? -v : v).toString();
}
