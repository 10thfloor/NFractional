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

  // Match: import "VaultShareToken" or import 'VaultShareToken'
  const patterns = [
    /import\s+["']VaultShareToken["']/g,
    /import\s+["']VaultShareToken["']\s*\n/g,
    /import\s+["']VaultShareToken["']\s*$/gm,
  ];

  let result = code;
  let replaced = false;

  for (const pattern of patterns) {
    if (pattern.test(result)) {
      pattern.lastIndex = 0; // Reset regex state
      result = result.replace(
        pattern,
        `import ${contractName} as VaultShareToken from ${addr}`
      );
      replaced = true;
      break;
    }
  }

  if (!replaced) {
    throw new Error(
      `VaultShareToken import not found in Cadence code. Cannot alias to ${contractName}.`
    );
  }

  // Verify replacement happened
  if (!result.includes(`import ${contractName} as VaultShareToken`)) {
    throw new Error(
      `Failed to alias VaultShareToken import to ${contractName} from ${addr}`
    );
  }

  return result;
}

export default with0x;
