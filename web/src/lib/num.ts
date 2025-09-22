import Decimal from "decimal.js";

export const SCALE = 8;
export const ROUND_DOWN = Decimal.ROUND_DOWN;

export function formatUFix64(v: Decimal.Value): string {
  const d = new Decimal(v || 0);
  // Produce exactly 8 fractional digits, rounded down to avoid overpaying
  return d.toFixed(SCALE, ROUND_DOWN);
}

export { Decimal };
