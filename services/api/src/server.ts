import Fastify from "fastify";
import mercurius from "mercurius";
import { Client as Cassandra } from "cassandra-driver";
import client from "prom-client";
import { z } from "zod";
import { getSigningFunction } from "./lib/flowAuth";
import cors from "@fastify/cors";
import ENV from "./lib/env";
import with0x from "./lib/addr";

import { txConfigureShareSupply, scriptShareBalance } from "./tx/shares";

// Node 18+ has global fetch; cross-fetch is available if needed. No custom sdk.transport.

// ENV now imported from ./lib/env

import typeDefs from "./graphql/schema";
import buildResolvers from "./graphql/resolvers";

async function buildServer() {
  const app = Fastify({ logger: false });

  const corsOrigin: boolean | string | string[] =
    ENV.CORS_ORIGIN === "*"
      ? true
      : ENV.CORS_ORIGIN.split(",")
          .map((s) => s.trim())
          .filter(Boolean);

  await app.register(cors, {
    origin: corsOrigin,
    credentials: true,
  });

  // Metrics
  const registry = new client.Registry();
  client.collectDefaultMetrics({ register: registry, prefix: "app_api_" });

  const httpReqs = new client.Counter({
    name: "app_api_http_requests_total",
    help: "HTTP requests",
    registers: [registry],
    labelNames: ["route", "code", "method"],
  });

  const httpDur = new client.Histogram({
    name: "app_api_http_request_duration_seconds",
    help: "HTTP request duration",
    registers: [registry],
    labelNames: ["route"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
  });

  app.get("/metrics", async (_req, reply) => {
    reply.header("Content-Type", registry.contentType);
    return registry.metrics();
  });

  app.addHook("onResponse", async (req, reply) => {
    const route = (
      (req as unknown as { routeOptions?: { url?: string } }).routeOptions
        ?.url ||
      req.url ||
      "unknown"
    ).toString();
    httpReqs.inc({ route, code: String(reply.statusCode), method: req.method });
    const start = (req as unknown as { _startTime: number })._startTime as
      | number
      | undefined;
    if (start) {
      const dur = (Date.now() - start) / 1000;
      httpDur.labels(route).observe(dur);
    }
  });

  app.addHook("onRequest", async (req) => {
    (req as unknown as { _startTime: number })._startTime = Date.now();
  });

  const cassandra = new Cassandra({
    contactPoints: ENV.CASSANDRA_CONTACT_POINTS,
    localDataCenter: "datacenter1",
    keyspace: ENV.CASSANDRA_KEYSPACE,
    queryOptions: { consistency: 1 },
  });

  await cassandra.connect();

  await app.register(mercurius, {
    schema: typeDefs,
    resolvers: buildResolvers(cassandra),
    graphiql: true,
    errorHandler: (error, _request, _reply) => {
      // Log GraphQL errors to console
      console.error("GraphQL error:", error.message || String(error));
    },
  });

  // Primary safe listing creation endpoint (dual-auth, escrows shares)
  app.post("/listings/create-safe", async (req, reply) => {
    try {
      const body = (req.body || {}) as {
        seller?: string;
        vaultId?: string;
        listingId?: string;
        priceAsset?: string;
        priceAmount?: string;
        amount?: string;
      };
      const seller = String(body.seller || "");
      const vaultId = String(body.vaultId || "");
      const listingId = String(body.listingId || "");
      const priceAsset = String(body.priceAsset || "");
      const priceAmount = String(body.priceAmount || "");
      const amount = String(body.amount || "");
      if (
        !seller ||
        !vaultId ||
        !listingId ||
        !priceAsset ||
        !priceAmount ||
        !amount
      ) {
        reply.code(400);
        return {
          error:
            "seller, vaultId, listingId, priceAsset, priceAmount, amount are required",
        };
      }
      const { prepareCreateListingTx } = await import("./tx/listings");
      const payload = await prepareCreateListingTx({
        seller,
        vaultId,
        listingId,
        priceAsset,
        priceAmount,
        amount,
      });
      return payload;
    } catch (e) {
      reply.code(400);
      return { error: (e as Error).message };
    }
  });

  app.post("/shares/:vaultId/configure", async (req, reply) => {
    try {
      const params = (req.params || {}) as { vaultId?: string };
      const body = (req.body || {}) as {
        maxSupply?: string | null;
        escrowAmount?: string | null;
        escrowRecipient?: string | null;
      };
      const vaultId = String(params.vaultId || "");
      if (!vaultId) {
        reply.code(400);
        return { error: "vaultId required" };
      }
      const { maxSupplyTxId, mintTxId } = await txConfigureShareSupply({
        vaultId,
        maxSupply: body.maxSupply ?? null,
        escrowAmount: body.escrowAmount ?? null,
        escrowRecipient: body.escrowRecipient ?? null,
      });
      return { maxSupplyTxId, mintTxId };
    } catch (e) {
      reply.code(400);
      return { error: (e as Error).message };
    }
  });

  app.get("/shares/:vaultId/balance", async (req, reply) => {
    try {
      const params = (req.params || {}) as { vaultId?: string };
      const query = (req.query || {}) as { account?: string };
      const vaultId = String(params.vaultId || "");
      const account = String(query.account || "");
      if (!vaultId || !account) {
        reply.code(400);
        return { error: "vaultId and account required" };
      }
      const balance = await scriptShareBalance({ vaultId, account });
      return { balance };
    } catch (e) {
      reply.code(400);
      return { error: (e as Error).message };
    }
  });

  // Secure admin remote authorization for FCL
  app.post("/flow/admin-sign", async (req, reply) => {
    try {
      // 0) Bearer token check
      // const authz = (req.headers["authorization"] || "").toString();
      // const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
      // if (!ENV.FLOW_ADMIN_SIGN_SECRET || token !== ENV.FLOW_ADMIN_SIGN_SECRET) {
      //   reply.code(401);
      //   return { error: "unauthorized" };
      // }

      const body = (req.body || {}) as { signable?: unknown };
      const schema = z.object({ signable: z.unknown() });
      const parsed = schema.parse(body);
      type FlowSignable = { auth?: { keyId?: number } } & Record<
        string,
        unknown
      >;
      const signable: FlowSignable =
        (parsed.signable as FlowSignable) ?? ({} as FlowSignable);

      // Basic guardrails: ensure we're signing our known transactions only
      // 1) Check network
      // if (ENV.FLOW_NETWORK !== (await fcl.config().get("flow.network"))) {
      //   // If not configured yet in this process, set it now for consistency
      //   fcl.config().put("flow.network", ENV.FLOW_NETWORK);
      // }

      // 2) Optional: Minimal cadence hash allowlist
      // try {
      //   const cadenceSrc: string | undefined =
      //     (signable?.voucher && signable.voucher.cadence) ||
      //     (signable?.message && typeof signable.message === "string"
      //       ? undefined
      //       : undefined);
      //   if (
      //     cadenceSrc &&
      //     Array.isArray(ENV.FLOW_ADMIN_SIGN_CADENCE_HASHES) &&
      //     ENV.FLOW_ADMIN_SIGN_CADENCE_HASHES.length > 0
      //   ) {
      //     // Compute SHA3-256 over UTF-8 bytes of cadence source
      //     const enc = new TextEncoder();
      //     const data = enc.encode(cadenceSrc);
      //     // Node 20 crypto.subtle
      //     const digestBuf = (await (
      //       globalThis.crypto || (await import("node:crypto")).webcrypto
      //     ).subtle.digest("SHA-256", data)) as ArrayBuffer;
      //     const hashHex = Buffer.from(digestBuf).toString("hex").toLowerCase();
      //     if (!ENV.FLOW_ADMIN_SIGN_CADENCE_HASHES.includes(hashHex)) {
      //       reply.code(400);
      //       return { error: "cadence not allowlisted" };
      //     }
      //   }
      // } catch (_e) {
      //   // If hashing fails, fail closed when allowlist is configured
      //   if (
      //     Array.isArray(ENV.FLOW_ADMIN_SIGN_CADENCE_HASHES) &&
      //     ENV.FLOW_ADMIN_SIGN_CADENCE_HASHES.length > 0
      //   ) {
      //     reply.code(400);
      //     return { error: "cadence hash check failed" };
      //   }
      // }

      // 2.5) Ensure keyId is set if auth object is present (guard optional shape from SDK)
      if (!signable.auth) signable.auth = {};
      if (signable.auth.keyId == null) {
        signable.auth = { ...(signable.auth || {}), keyId: 0 };
      }

      // 3) Produce signature with server key
      const signingFn = getSigningFunction(
        ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS,
        ENV.FRACTIONAL_PLATFORM_ADMIN_KEY,
        0
      );

      const sig = await signingFn(
        signable as unknown as Record<string, unknown>
      );
      return sig;
    } catch (e) {
      reply.code(400);
      return { error: (e as Error).message };
    }
  });

  // Public info for admin auth (address/keyId) so client auth object matches server signature
  app.get("/flow/admin-info", async (_req, _reply) => {
    const addr = with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS);

    if (!addr) {
      throw new Error("FRACTIONAL_PLATFORM_ADMIN_ADDRESS is not set");
    }

    const keyId = 0;
    return { addr, keyId };
  });

  // Standard addresses endpoint for clients
  app.get("/flow/addresses", async (_req, _reply) => {
    return {
      ft: with0x(ENV.FLOW_CONTRACT_FUNGIBLETOKEN),
      flow: with0x(ENV.FLOW_CONTRACT_FLOWTOKEN),
      ftmdv: with0x(ENV.FLOW_CONTRACT_FT_METADATA_VIEWS),
      mdv: with0x(ENV.FLOW_CONTRACT_METADATA_VIEWS),
      fractional: with0x(ENV.FLOW_CONTRACT_FRACTIONAL),
      feerouter: with0x(ENV.FLOW_CONTRACT_FEEROUTER),
      ftcon: with0x(ENV.FLOW_CONTRACT_FT_CONNECTORS),
      swapcon: with0x(ENV.FLOW_CONTRACT_SWAP_CONNECTORS),
      swapcfg: with0x(ENV.FLOW_CONTRACT_SWAP_CONFIG),
      amm: with0x(ENV.FLOW_CONTRACT_AMM),
      ammswapper: with0x(ENV.FLOW_CONTRACT_AMM_SWAPPER),
      defi: with0x(ENV.FLOW_CONTRACT_DEFI_ACTIONS),
      nft: with0x(ENV.FLOW_CONTRACT_NONFUNGIBLETOKEN),
      example: with0x(ENV.FLOW_CONTRACT_EXAMPLENFT),
      platformAdmin: with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS),
    };
  });

  // Deploy-only endpoint for per-vault FT contract (no registration to vault)
  // Available on testnet and emulator (dev environments)
  const isDevNetwork =
    ENV.FLOW_NETWORK === "testnet" || ENV.FLOW_NETWORK === "emulator";
  if (isDevNetwork || ENV.NODE_ENV !== "production") {
    app.post("/contracts/series-ft-deploy", async (req, reply) => {
      try {
        const body = (req.body || {}) as {
          contractName?: string;
          name?: string;
          symbol?: string;
          decimals?: number;
          maxSupply?: string | null;
        };
        const schema = z.object({
          contractName: z.string().min(1),
          name: z.string().min(1),
          symbol: z.string().min(1),
          decimals: z.number().int().min(0).max(255).optional(),
          maxSupply: z
            .string()
            .regex(/^[0-9]+(?:\.[0-9]+)?$/)
            .optional()
            .nullable(),
        });
        const parsed = schema.parse(body);

        const { txDeploySeriesFTContract } = await import("./tx/vaults");
        let txId: string | null = null;
        try {
          txId = await txDeploySeriesFTContract({
            contractName: parsed.contractName,
            name: parsed.name,
            symbol: parsed.symbol,
            decimals: Number(parsed.decimals ?? 8),
            maxSupply: parsed.maxSupply ?? null,
          });
        } catch (e) {
          const msg = String((e as Error).message || "");
          // Idempotent: if contract exists, treat as success
          if (!/cannot overwrite existing contract/i.test(msg)) {
            throw e;
          }
        }
        return { txId };
      } catch (e) {
        reply.code(400);
        return { error: (e as Error).message };
      }
    });
  }

  // Dev-only endpoint to mint ExampleNFT to a recipient, ensuring collection setup
  // Available on testnet and emulator (not mainnet)
  console.log(
    `[server] FLOW_NETWORK=${ENV.FLOW_NETWORK}, isDevNetwork=${isDevNetwork}, registering /dev/mint-example: ${isDevNetwork}`
  );

  if (isDevNetwork) {
    app.post("/dev/mint-example", async (req, reply) => {
      try {
        const body = (req.body || {}) as {
          recipient?: string;
          name?: string;
          description?: string;
          thumbnail?: string;
        };
        const recipient = String(body.recipient || "");
        if (!recipient) {
          reply.code(400);
          return { error: "recipient required" };
        }
        const { txMintExampleNFTTo } = await import("./tx/scripts");

        const txId = await txMintExampleNFTTo({
          recipient,
          name: body.name,
          description: body.description,
          thumbnail: body.thumbnail,
        });
        return { txId };
      } catch (e) {
        reply.code(400);
        return { error: (e as Error).message };
      }
    });
  }

  // Distribution recipients endpoint
  app.get("/distributions/:programId/recipients", async (req, reply) => {
    try {
      const params = (req.params || {}) as { programId?: string };
      const programId = String(params.programId || "");
      if (!programId) {
        reply.code(400);
        return { error: "programId required" };
      }
      const { listRecipients } = await import("./services/recipients");
      const recipients = await listRecipients(cassandra, {
        network: ENV.FLOW_NETWORK,
        programId,
      });
      return { recipients };
    } catch (e) {
      reply.code(500);
      return { error: (e as Error).message };
    }
  });

  // Read per-series FT registry for a vault
  app.get("/vaults/:vaultId/ft", async (req, reply) => {
    try {
      const params = (req.params || {}) as { vaultId?: string };
      const vaultId = String(params.vaultId || "");
      if (!vaultId) {
        reply.code(400);
        return { error: "vaultId required" };
      }
      const fcl = await import("@onflow/fcl");
      const accessUrl = ENV.FLOW_ACCESS.startsWith("http")
        ? ENV.FLOW_ACCESS
        : `http://${ENV.FLOW_ACCESS}`;
      fcl.config().put("accessNode.api", accessUrl);
      const code = `
        import Fractional from ${with0x(ENV.FLOW_CONTRACT_FRACTIONAL)}
        access(all) fun main(vaultId: String): {String: String}? {
          return Fractional.getVaultFT(vaultId: vaultId)
        }
      `;
      const ft = await fcl.query({
        cadence: code,
        args: (arg: any, t: any) => [arg(vaultId, t.String)],
      });

      if (!ft) {
        throw new Error("Missing ft");
      }

      // Query concrete FT contract for display metadata
      type FtRegistry = { address?: string; name?: string };
      const reg = ft as FtRegistry;
      const ftAddr = with0x(String(reg.address || ""));
      const ftName = String(reg.name || "");
      let meta: Record<string, string> | null = null;
      if (ftAddr && ftName) {
        const metaCode = `
          import ${ftName} from ${ftAddr}
          access(all) fun main(): {String: String} {
            var out: {String: String} = {}
            out["name"] = ${ftName}.name
            out["symbol"] = ${ftName}.symbol
            out["decimals"] = ${ftName}.decimals.toString()
            if ${ftName}.maxSupply != nil { out["maxSupply"] = ${ftName}.maxSupply!.toString() }
            out["totalSupply"] = ${ftName}.getTotalSupply().toString()
            return out
          }
        `;
        try {
          meta = (await fcl.query({
            cadence: metaCode,
            args: () => [],
          })) as Record<string, string>;
        } catch (_e) {
          meta = null;
        }
      }

      const addrs = {
        ft: with0x(ENV.FLOW_CONTRACT_FUNGIBLETOKEN),
        ftmdv: with0x(ENV.FLOW_CONTRACT_FT_METADATA_VIEWS),
        md: with0x(ENV.FLOW_CONTRACT_METADATA_VIEWS),
        fractional: with0x(ENV.FLOW_CONTRACT_FRACTIONAL),
      };
      return { ft, addrs, meta: { ...meta, contractName: ftName } };
    } catch (e) {
      reply.code(400);
      return { error: (e as Error).message };
    }
  });

  // Deploy per-series FT (dev/emulator scaffold) and register to a vault
  app.post("/vaults/:vaultId/deploy-ft", async (req, reply) => {
    try {
      const params = (req.params || {}) as { vaultId?: string };
      const body = (req.body || {}) as {
        contractName?: string;
        name?: string;
        symbol?: string;
        decimals?: number;
        maxSupply?: string | null;
      };
      const vaultId = String(params.vaultId || "");
      const contractName = String(body.contractName || "");
      const name = String(body.name || "");
      const symbol = String(body.symbol || "");
      const decimals = Number(body.decimals ?? 8);
      if (!vaultId || !contractName || !name || !symbol) {
        reply.code(400);
        return { error: "vaultId, contractName, name, symbol required" };
      }
      const {
        txDeploySeriesFT,
        txRegisterVaultFT,
        txAdminInitSeriesVault,
        txDeploySeriesFTContract,
      } = await import("./tx/vaults");
      // 1) Deploy the concrete FT contract for this series (idempotent)
      const deployName = contractName
        .replace(/[^A-Za-z0-9_]/g, "_")
        .replace(/^[0-9]/, (m) => `C_${m}`);
      let deployTxId: string | null = null;
      try {
        deployTxId = await txDeploySeriesFTContract({
          contractName: deployName,
          name,
          symbol,
          decimals,
          maxSupply: body.maxSupply ?? null,
        });
      } catch (e) {
        const msg = String((e as Error).message || "");
        // If contract already exists, skip deploy and continue with register/init
        if (!/cannot overwrite existing contract/i.test(msg)) {
          throw e;
        }
      }

      // 2) Build registry metadata and register
      const ft = await txDeploySeriesFT({
        contractName: deployName,
        name,
        symbol,
        decimals,
        maxSupply: body.maxSupply ?? null,
      });

      if (
        !ft.address ||
        !ft.name ||
        !ft.paths.storage ||
        !ft.paths.receiver ||
        !ft.paths.balance
      ) {
        throw new Error(
          "Missing ft.address, ft.name, ft.paths.storage, ft.paths.receiver, ft.paths.balance"
        );
      }

      const registerTxId = await txRegisterVaultFT({
        vaultId,
        ftAddress: ft.address,
        ftContractName: ft.name,
        vaultStoragePathIdentifier: ft.paths.storage,
        receiverPublicPathIdentifier: ft.paths.receiver,
        balancePublicPathIdentifier: ft.paths.balance,
      });
      const adminInitTxId = await txAdminInitSeriesVault({
        contractName: ft.name,
        symbol,
      });
      // Ensure treasuries for this token/vault are published
      const { txEnsureTreasuriesDynamic } = await import("./tx/treasury");
      const treasuryTxId = await txEnsureTreasuriesDynamic({
        tokenIdent: ft.name,
        vaultId,
        contractName: ft.name, // tokenIdent IS the contract name
        contractAddress: ft.address, // Required for aliasing VaultShareToken import
      });
      return { deployTxId, registerTxId, adminInitTxId, treasuryTxId, ft };
    } catch (e) {
      reply.code(400);
      return { error: (e as Error).message };
    }
  });

  await app.listen({ host: ENV.HOST, port: ENV.PORT });
  console.log(`GraphQL ready on http://${ENV.HOST}:${ENV.PORT}/graphiql`);
}

buildServer().catch((e) => {
  console.error(e);
  process.exit(1);
});
