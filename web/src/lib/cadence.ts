// Utilities for preparing Cadence sources safely at runtime

/** Normalize Flow address to 0x-prefixed hex without account identifier syntax. */
export function normalizeFlowAddress(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return "";
  // Handle A.<hex> form
  if (raw.startsWith("A.")) {
    const parts = raw.split(".");
    const hex = parts[1] || "";
    return `0x${hex.replace(/^0x/i, "")}`;
  }
  // Ensure 0x prefix
  const hex = raw.replace(/^0x/i, "");
  const normalized = `0x${hex}`;
  if (!/^0x[0-9a-fA-F]+$/.test(normalized)) {
    throw new Error(`invalid Flow address format: ${input}`);
  }
  return normalized;
}

/**
 * Replace any placeholder or existing VaultShareToken import with a concrete alias.
 * Ensures there is exactly one import using contractName and normalized address.
 */
export function aliasVaultShareImport(
  cadence: string,
  contractName: string,
  address: string
): string {
  if (!cadence || !contractName || !address) {
    throw new Error("aliasVaultShareImport: missing params");
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(contractName)) {
    throw new Error(`invalid contract name: ${contractName}`);
  }
  const addr = normalizeFlowAddress(address);

  // Prepare target line
  const aliasLine = `import ${contractName} as VaultShareToken from ${addr}`;

  let updated = cadence;
  // Replace placeholder forms: import "VaultShareToken" | 'VaultShareToken'
  updated = updated.replace(/import\s+["']VaultShareToken["']/g, aliasLine);

  // Replace any existing line that imports VaultShareToken in another way
  updated = updated.replace(
    /^\s*import\s+.*\bVaultShareToken\b.*$/gm,
    aliasLine
  );

  // Deduplicate if multiple identical import lines ended up present
  const lines = updated.split("\n");
  const seen = new Set<string>();
  const resultLines: string[] = [];
  for (const line of lines) {
    const isAlias = line.trim() === aliasLine;
    if (isAlias) {
      if (seen.has(aliasLine)) continue;
      seen.add(aliasLine);
    }
    resultLines.push(line);
  }
  return resultLines.join("\n");
}

/** Ensure a valid Cadence UFix64 literal string: use Decimal-based fixed 8 rounding down. */
export function ensureUFix64String(value: string): string {
  // Lazy import to avoid circular deps during build
   
  const {
    formatUFix64,
  }: { formatUFix64: (v: unknown) => string } = require("./num");
  return formatUFix64((value ?? "").toString().trim().replace(/,/g, ""));
}

/**
 * TEMP: Ensure core imports have explicit addresses to avoid variance issues across environments.
 * Rewrites imports for NonFungibleToken, FungibleToken, and Fractional using API-provided addresses.
 */
export async function tempAddImports(
  cadence: string,
  apiBase?: string
): Promise<string> {
  const base = (
    apiBase ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000/graphql"
  ).replace(/\/graphql$/, "");
  const res = await fetch(`${base}/flow/addresses`, { cache: "no-store" });
  if (!res.ok) throw new Error(`addresses fetch failed: ${res.status}`);
  const addrs = (await res.json()) as {
    nft?: string;
    ft?: string;
    fractional?: string;
    flow?: string;
    amm?: string;
    ammswapper?: string;
    defi?: string;
    feerouter?: string;
    ftcon?: string; // FungibleTokenConnectors
    ftmdv?: string; // FungibleTokenMetadataViews
    mdv?: string; // MetadataViews
  };
  const nftAddr = normalizeFlowAddress(addrs.nft || "");
  const ftAddr = normalizeFlowAddress(addrs.ft || "");
  const fracAddr = normalizeFlowAddress(addrs.fractional || "");
  const flowAddr = addrs.flow ? normalizeFlowAddress(addrs.flow) : "";
  const ammAddr = addrs.amm ? normalizeFlowAddress(addrs.amm) : "";
  const ammswapperAddr = addrs.ammswapper
    ? normalizeFlowAddress(addrs.ammswapper)
    : "";
  const defiAddr = addrs.defi ? normalizeFlowAddress(addrs.defi) : "";
  const feeRouterAddr = addrs.feerouter
    ? normalizeFlowAddress(addrs.feerouter)
    : "";
  const ftconAddr = addrs.ftcon ? normalizeFlowAddress(addrs.ftcon) : "";
  const ftmdvAddr = addrs.ftmdv ? normalizeFlowAddress(addrs.ftmdv) : "";
  const mdvAddr = addrs.mdv ? normalizeFlowAddress(addrs.mdv) : "";
  if (!nftAddr || !ftAddr || !fracAddr) return cadence;

  const rules: Array<{ name: string; addr: string }> = [
    { name: "NonFungibleToken", addr: nftAddr },
    { name: "FungibleToken", addr: ftAddr },
    { name: "Fractional", addr: fracAddr },
    // Optional mappings when present from API
    ...(flowAddr ? [{ name: "FlowToken", addr: flowAddr }] : []),
    ...(ammAddr ? [{ name: "ConstantProductAMM", addr: ammAddr }] : []),
    ...(ammswapperAddr
      ? [{ name: "ConstantProductAMMSwapper", addr: ammswapperAddr }]
      : []),
    ...(defiAddr ? [{ name: "DeFiActions", addr: defiAddr }] : []),
    ...(feeRouterAddr ? [{ name: "FeeRouter", addr: feeRouterAddr }] : []),
    ...(ftconAddr
      ? [{ name: "FungibleTokenConnectors", addr: ftconAddr }]
      : []),
    ...(ftmdvAddr
      ? [{ name: "FungibleTokenMetadataViews", addr: ftmdvAddr }]
      : []),
    ...(mdvAddr ? [{ name: "MetadataViews", addr: mdvAddr }] : []),
  ];

  let updated = cadence;
  updated = updated.replace(
    /(from\s+)A\.([0-9a-fA-F]{16})(?:\.[A-Za-z_][A-Za-z0-9_]*)?/g,
    (_m, prefix: string, hex: string) => `${prefix}0x${hex}`
  );
  for (const { name, addr } of rules) {
    const aliasLine = `import ${name} from ${addr}`;
    // Replace string import form
    const stringRegex = new RegExp(`import\\s+[\"']${name}[\"']`, "g");
    updated = updated.replace(stringRegex, aliasLine);
    // Replace any import that mentions the contract without address
    const anyLineRegex = new RegExp(
      `^\\s*import\\s+${name}(?!\\s+from)\\s*$`,
      "gm"
    );
    updated = updated.replace(anyLineRegex, aliasLine);
    // Replace existing address with normalized
    const withFromRegex = new RegExp(
      `^\\s*import\\s+${name}\\s+from\\s+.*$`,
      "gm"
    );
    updated = updated.replace(withFromRegex, aliasLine);

    // Deduplicate identical lines
    const lines = updated.split("\n");
    const out: string[] = [];
    let seen = false;
    for (const line of lines) {
      const isThis = line.trim() === aliasLine;
      if (isThis) {
        if (seen) continue;
        seen = true;
      }
      out.push(line);
    }
    updated = out.join("\n");
  }

  return updated;
}
