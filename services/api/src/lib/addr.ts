export function with0x(addr: string | undefined | null): string {
  const a = String(addr || "").trim();
  if (a.length === 0) return "0x"; // minimal placeholder; callers should validate non-empty upstream
  return a.startsWith("0x") ? a : `0x${a}`;
}

export function strip0x(addr: string | undefined | null): string {
  const normalized = String(addr || "").trim();
  return normalized.replace(/^0x/i, "");
}

export function has0x(addr: string | undefined | null): boolean {
  const normalized = String(addr || "").trim();
  return /^0x[0-9a-fA-F]*$/.test(normalized);
}

// Helper to alias per-vault FT contract to VaultShareToken in Cadence imports
export function aliasVaultShareImport(
  code: string,
  contractName: string,
  contractAddress: string
): string {
  const addr = with0x(contractAddress);

  // Normalize any form of VaultShareToken import to the correct alias line
  const aliasLine = `import ${contractName} as VaultShareToken from ${addr}`;

  // Cases to handle:
  // 1) import "VaultShareToken"
  // 2) import 'VaultShareToken'
  // 3) import VaultShareToken from 0x...
  // 4) import <anything> as VaultShareToken from ...
  // 5) import <anything> as VaultShareToken

  let result = code;

  // Replace string import placeholders
  result = result.replace(
    /^[\t ]*import\s+["']VaultShareToken["'][\t ]*$/gm,
    aliasLine
  );
  result = result.replace(/import\s+["']VaultShareToken["']/g, aliasLine);

  // Replace any existing import that aliases as VaultShareToken (left side arbitrary)
  result = result.replace(
    /^[\t ]*import\s+[^\n]*\bas\s+VaultShareToken\b[^\n]*$/gm,
    aliasLine
  );

  // Replace any existing import of VaultShareToken without alias but with address
  result = result.replace(
    /^[\t ]*import\s+VaultShareToken\b[^\n]*$/gm,
    aliasLine
  );

  // Final verification
  if (!result.includes(aliasLine)) {
    throw new Error(
      `Failed to alias VaultShareToken import to ${contractName} at ${addr}`
    );
  }

  return result;
}

export default with0x;
