import { Decimal, ROUND_DOWN } from "@/lib/num";
export function sanitizeDecimalInput(raw: string, allowNegative = false): string {
  if (!raw) return "";
  let s = raw.replace(/,/g, "").replace(/\s+/g, "");
  // Keep optional leading minus if allowed
  const hasMinus = allowNegative && s.startsWith("-");
  if (hasMinus) s = s.slice(1);

  // Remove all non-digits/dots
  s = s.replace(/[^0-9.]/g, "");

  // Only keep first dot
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }

  // Restore minus if any content
  if (hasMinus) s = "-" + s;
  return s;
}

export function clampDecimals(value: string, decimals: number): string {
  if (!value) return value;
  const neg = value.startsWith("-");
  const s = neg ? value.slice(1) : value;
  const parts = s.split(".");
  if (parts.length === 1) return (neg ? "-" : "") + parts[0];
  const head = parts[0] || "0";
  const tail = parts[1]?.slice(0, Math.max(0, decimals)) ?? "";
  return (neg ? "-" : "") + (tail.length ? `${head}.${tail}` : head);
}

export function isValidNumericString(
  value: string,
  allowNegative = false,
  decimals = 2
): boolean {
  if (!value) return false;
  const sanitized = sanitizeDecimalInput(value, allowNegative);
  if (!sanitized || sanitized === "-" || sanitized === ".") return false;
  try {
    const d = new Decimal(sanitized);
    if (!allowNegative && d.isNeg()) return false;
    return d.decimalPlaces() <= Math.max(0, decimals);
  } catch {
    return false;
  }
}

export function formatFixed(
  value: string | number,
  decimals = 2,
  roundingMode: Decimal.Rounding = ROUND_DOWN
): string {
  if (value === "" || value === null || value === undefined) return "";
  try {
    const d = new Decimal(value as Decimal.Value);
    return d.toFixed(Math.max(0, decimals), roundingMode);
  } catch {
    return "";
  }
}

export function normalizeOnBlur(
  value: string,
  {
    allowNegative = false,
    decimals = 2,
    roundingMode = ROUND_DOWN,
  }: {
    allowNegative?: boolean;
    decimals?: number;
    roundingMode?: Decimal.Rounding;
  }
): { display: string; normalized: string; valid: boolean } {
  const s1 = sanitizeDecimalInput(value, allowNegative);
  if (!s1 || s1 === "-" || s1 === ".") {
    return { display: "", normalized: "", valid: false };
  }
  try {
    const d = new Decimal(s1);
    const fixed = d.toFixed(Math.max(0, decimals), roundingMode);
    return { display: fixed, normalized: fixed, valid: true };
  } catch {
    return { display: s1, normalized: s1, valid: false };
  }
}


