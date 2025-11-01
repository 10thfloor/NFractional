const addrs = {
  emulator: "f8d6e0586b0a20c7",
  emulatorFlowAdmin: "179b6b1cb6755e31",
  testnetAdmin: "237656746bc69765", // testnet-admin address (without 0x)
};

// Testnet addresses from flow.json
const testnetAddrs = {
  // Custom contracts (all deployed to testnet-admin)
  testnetAdmin: "237656746bc69765",
  // Standard contracts
  FlowToken: "7e60df042a9c0868",
  FungibleToken: "9a0766d93b6608b7",
  FungibleTokenMetadataViews: "9a0766d93b6608b7",
  NonFungibleToken: "631e88ae7f1d7c20",
  MetadataViews: "631e88ae7f1d7c20",
  ViewResolver: "631e88ae7f1d7c20",
  FungibleTokenConnectors: "5a7b9cee9aaf4e4e",
  DeFiActions: "4c2ff9dd03ab442f",
  DeFiActionsUtils: "4c2ff9dd03ab442f",
  DeFiActionsMathUtils: "4c2ff9dd03ab442f",
};

// Determine network-based defaults
const network = process.env.FLOW_NETWORK || "emulator";
const isTestnet = network === "testnet";
const isProduction = process.env.NODE_ENV === "production";

export const ENV = {
  PORT: Number(process.env.PORT || 4000),
  HOST: process.env.HOST || "0.0.0.0",
  CASSANDRA_CONTACT_POINTS: (
    process.env.CASSANDRA_CONTACT_POINTS || "scylla"
  ).split(","),
  CASSANDRA_KEYSPACE: process.env.CASSANDRA_KEYSPACE || "fractional",
  FLOW_ACCESS: process.env.FLOW_ACCESS || "http://host.docker.internal:8888",
  FLOW_NETWORK: network,

  // Optional: privileged minter account (for dev-only minting of ExampleNFT)
  FLOW_MINTER_ADDR: process.env.FLOW_MINTER_ADDR || "",
  FLOW_MINTER_KEY: process.env.FLOW_MINTER_KEY || "",

  // Security for /flow/admin-sign endpoint
  // REQUIRED in production. Generate a strong random string (e.g., openssl rand -hex 32)
  FLOW_ADMIN_SIGN_SECRET:
    process.env.FLOW_ADMIN_SIGN_SECRET || (isProduction ? "" : "keyboardcat"),
  // Optional comma-separated list of SHA3-256 hashes (hex) of allowed Cadence sources
  // present in signable.voucher.cadence. Leave empty to skip cadence allowlisting.
  FLOW_ADMIN_SIGN_CADENCE_HASHES: (
    process.env.FLOW_ADMIN_SIGN_CADENCE_HASHES || ""
  )
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),

  // Admin API key for privileged GraphQL/HTTP mutations (header: X-Admin-Auth)
  // REQUIRED in production. Generate a strong random string (e.g., openssl rand -hex 32)
  ADMIN_API_KEY:
    process.env.ADMIN_API_KEY || (isProduction ? "" : "keyboard-cat"),

  // CORS origin - REQUIRED in production. Must be explicit origin(s), not "*"
  // Examples: "https://flow-web.fly.dev" or "http://localhost:3000,https://example.com"
  CORS_ORIGIN: process.env.CORS_ORIGIN || (isProduction ? "" : "*"),
  NODE_ENV: process.env.NODE_ENV || "development",

  // Canonical contract addresses (hex without 0x) — prefer these going forward.
  // Defaults to testnet addresses when FLOW_NETWORK=testnet, otherwise emulator
  FLOW_CONTRACT_FUNGIBLETOKEN:
    process.env.FLOW_CONTRACT_FUNGIBLETOKEN ||
    (isTestnet ? testnetAddrs.FungibleToken : "ee82856bf20e2aa6"),

  FLOW_CONTRACT_FLOWTOKEN:
    process.env.FLOW_CONTRACT_FLOWTOKEN ||
    (isTestnet ? testnetAddrs.FlowToken : "0ae53cb6e3f42a79"),

  FLOW_CONTRACT_EXAMPLENFT:
    process.env.FLOW_CONTRACT_EXAMPLENFT ||
    (isTestnet ? testnetAddrs.testnetAdmin : addrs.emulator),

  FLOW_CONTRACT_NONFUNGIBLETOKEN:
    process.env.FLOW_CONTRACT_NONFUNGIBLETOKEN ||
    (isTestnet ? testnetAddrs.NonFungibleToken : addrs.emulator),

  FLOW_CONTRACT_FT_METADATA_VIEWS:
    process.env.FLOW_CONTRACT_FT_METADATA_VIEWS ||
    (isTestnet ? testnetAddrs.FungibleTokenMetadataViews : "ee82856bf20e2aa6"),

  FLOW_CONTRACT_METADATA_VIEWS:
    process.env.FLOW_CONTRACT_METADATA_VIEWS ||
    (isTestnet ? testnetAddrs.MetadataViews : addrs.emulator),

  FLOW_CONTRACT_FRACTIONAL:
    process.env.FLOW_CONTRACT_FRACTIONAL ||
    (isTestnet ? testnetAddrs.testnetAdmin : addrs.emulator),

  // FeeRouter (centralized fee logic)
  FLOW_CONTRACT_FEEROUTER:
    process.env.FLOW_CONTRACT_FEEROUTER ||
    (isTestnet ? testnetAddrs.testnetAdmin : addrs.emulator),

  FLOW_CONTRACT_FT_CONNECTORS:
    process.env.FLOW_CONTRACT_FT_CONNECTORS ||
    (isTestnet ? testnetAddrs.FungibleTokenConnectors : addrs.emulator),

  FLOW_CONTRACT_SWAP_CONNECTORS:
    process.env.FLOW_CONTRACT_SWAP_CONNECTORS ||
    (isTestnet ? testnetAddrs.testnetAdmin : addrs.emulator),

  FLOW_CONTRACT_SWAP_CONFIG:
    process.env.FLOW_CONTRACT_SWAP_CONFIG ||
    (isTestnet ? testnetAddrs.testnetAdmin : addrs.emulator),

  // AMM contracts
  FLOW_CONTRACT_AMM:
    process.env.FLOW_CONTRACT_AMM ||
    (isTestnet ? testnetAddrs.testnetAdmin : addrs.emulator),

  FLOW_CONTRACT_AMM_SWAPPER:
    process.env.FLOW_CONTRACT_AMM_SWAPPER ||
    (isTestnet ? testnetAddrs.testnetAdmin : addrs.emulator),

  FLOW_CONTRACT_DEFI_ACTIONS:
    process.env.FLOW_CONTRACT_DEFI_ACTIONS ||
    (isTestnet ? testnetAddrs.DeFiActions : addrs.emulator),

  FLOW_CONTRACT_DEFI_ACTIONS_UTILS:
    process.env.FLOW_CONTRACT_DEFI_ACTIONS_UTILS ||
    (isTestnet ? testnetAddrs.DeFiActionsUtils : addrs.emulator),

  FLOW_CONTRACT_DEFI_ACTIONS_MATH_UTILS:
    process.env.FLOW_CONTRACT_DEFI_ACTIONS_MATH_UTILS ||
    (isTestnet ? testnetAddrs.DeFiActionsMathUtils : addrs.emulator),

  FLOW_CONTRACT_FLOWTRANSACTIONSCHEDULER:
    process.env.FLOW_CONTRACT_FLOWTRANSACTIONSCHEDULER ||
    (isTestnet ? testnetAddrs.testnetAdmin : addrs.emulatorFlowAdmin),

  FLOW_CONTRACT_FLOWTRANSACTIONSCHEDULERUTILS:
    process.env.FLOW_CONTRACT_FLOWTRANSACTIONSCHEDULERUTILS ||
    (isTestnet ? testnetAddrs.testnetAdmin : addrs.emulatorFlowAdmin),

  FRACTIONAL_PLATFORM_ADMIN_ADDRESS:
    process.env.FRACTIONAL_PLATFORM_ADMIN_ADDRESS ||
    (isTestnet ? testnetAddrs.testnetAdmin : addrs.emulatorFlowAdmin),

  FRACTIONAL_PLATFORM_ADMIN_KEY:
    process.env.FRACTIONAL_PLATFORM_ADMIN_KEY || "",

  // Comma-separated list of hex addresses (with or without 0x) that represent
  // team/treasury accounts whose balances should be excluded from circulating.
  TEAM_ADDRESSES: (process.env.TEAM_ADDRESSES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
} as const;

/**
 * Validate that all required secrets are set in production environment.
 * Throws an error with clear messages if any required secrets are missing.
 */
export function validateProductionEnv(): void {
  if (!isProduction) {
    return; // Skip validation in development
  }

  const missing: string[] = [];

  if (!ENV.FLOW_ADMIN_SIGN_SECRET || ENV.FLOW_ADMIN_SIGN_SECRET.trim() === "") {
    missing.push("FLOW_ADMIN_SIGN_SECRET");
  }

  if (!ENV.ADMIN_API_KEY || ENV.ADMIN_API_KEY.trim() === "") {
    missing.push("ADMIN_API_KEY");
  }

  if (!ENV.CORS_ORIGIN || ENV.CORS_ORIGIN.trim() === "") {
    missing.push("CORS_ORIGIN");
  }

  if (ENV.CORS_ORIGIN === "*") {
    throw new Error(
      "CORS_ORIGIN cannot be '*' in production. Set an explicit origin (e.g., 'https://flow-web.fly.dev')"
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables in production: ${missing.join(
        ", "
      )}. Generate strong secrets using: openssl rand -hex 32`
    );
  }
}

export default ENV;
