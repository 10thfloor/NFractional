export function toSafePathIdentifier(input: string): string {
  return String(input || "")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "");
}


