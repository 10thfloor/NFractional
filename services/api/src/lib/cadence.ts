import fs from "node:fs";
import path from "node:path";
import ENV from "./env";
import with0x from "./addr";

const NAME_TO_ENV_KEY: Record<string, keyof typeof ENV> = {
  FungibleToken: "FLOW_CONTRACT_FUNGIBLETOKEN",
  FlowToken: "FLOW_CONTRACT_FLOWTOKEN",
  NonFungibleToken: "FLOW_CONTRACT_NONFUNGIBLETOKEN",
  FungibleTokenMetadataViews: "FLOW_CONTRACT_FT_METADATA_VIEWS",
  MetadataViews: "FLOW_CONTRACT_METADATA_VIEWS",
  ViewResolver: "FLOW_CONTRACT_METADATA_VIEWS",
  Fractional: "FLOW_CONTRACT_FRACTIONAL",
  FeeRouter: "FLOW_CONTRACT_FEEROUTER",
  FungibleTokenConnectors: "FLOW_CONTRACT_FT_CONNECTORS",
  ConstantProductAMM: "FLOW_CONTRACT_AMM",
  ConstantProductAMMSwapper: "FLOW_CONTRACT_AMM_SWAPPER",
  ExampleNFT: "FLOW_CONTRACT_EXAMPLENFT",
};

function resolveCadenceRoot(): string {
  const fromEnv = process.env.CADENCE_DIR;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv;
  // default when running in container after COPY flow/...
  const containerDefault = path.resolve(process.cwd(), "flow/cadence");
  if (fs.existsSync(containerDefault)) return containerDefault;
  // local dev fallback (repo root relative)
  const devFallback = path.resolve(__dirname, "../../../flow/cadence");
  return devFallback;
}

function rewriteImports(src: string): string {
  return src.replace(
    /import\s+["']([A-Za-z0-9_]+)["']/g,
    (_m, name: string) => {
      // VaultShareToken is handled dynamically per-vault via aliasVaultShareImport
      // Never rewrite it here - it must be aliased manually with the correct contract name and address
      if (name === "VaultShareToken") {
        return _m; // Keep as-is for manual aliasing
      }
      const key = NAME_TO_ENV_KEY[name];
      if (!key) return _m; // unknown import stays as-is
      const raw = (ENV as unknown as Record<string, string>)[key] || "";
      // Sanitize in case env mistakenly includes contract identifier (e.g., 0xABC...DEF.MetadataViews)
      const m = raw.match(/0x[0-9a-fA-F]+/);
      const onlyAddr = m ? m[0] : raw;
      const withPrefix = with0x(onlyAddr);
      return `import ${name} from ${withPrefix}`;
    }
  );
}

export function getCadence(relPath: string): string {
  const root = resolveCadenceRoot();
  const full = path.resolve(root, relPath);
  const raw = fs.readFileSync(full, "utf8");
  return rewriteImports(raw);
}

export default getCadence;
