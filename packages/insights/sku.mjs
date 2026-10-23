// SKU base: mayúsculas y sin sufijos de Walmart (-WMxx), FBA (-001A-001) ni -NEW. MISMA regla que el SQL de insights_refresh_refund_sku (DATOS.md §1.2).
export const SKU_SUFFIX = /(-WM[0-9]+|-[0-9]{3}A-[0-9]{3}|-NEW)$/;
export function normalizarSku(raw) {
  const s = String(raw ?? '').trim().toUpperCase();
  if (!s || s === 'PENDING' || s.length > 80) return null;
  return s.replace(SKU_SUFFIX, '') || null;
}
