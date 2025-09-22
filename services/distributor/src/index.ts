import { connect, AckPolicy, DeliverPolicy } from "nats";
import { Client as Cassandra } from "cassandra-driver";
import * as fcl from "@onflow/fcl";
import * as t from "@onflow/types";
import fs from "node:fs";
import path from "node:path";
import elliptic from "elliptic";
import { SHA3 } from "sha3";

// Environment configuration
const ENV = {
  NATS_URL: process.env.NATS_URL || "nats://nats:4222",
  NETWORK: process.env.NETWORK || "emulator",
  CASSANDRA_CONTACT_POINTS: (
    process.env.CASSANDRA_CONTACT_POINTS || "scylla"
  ).split(","),
  CASSANDRA_KEYSPACE: process.env.CASSANDRA_KEYSPACE || "fractional",
  POLL_INTERVAL_MS: Number(process.env.DISTRIBUTOR_POLL_INTERVAL_MS || 60000),
  FLOW_ACCESS: process.env.FLOW_ACCESS || "http://host.docker.internal:8888",
  FLOW_CONTRACT_FRACTIONAL:
    process.env.FLOW_CONTRACT_FRACTIONAL || "f8d6e0586b0a20c7",
  FLOW_CONTRACT_FT_CONNECTORS:
    process.env.FLOW_CONTRACT_FT_CONNECTORS || "f8d6e0586b0a20c7",
  FRACTIONAL_PLATFORM_ADMIN_ADDRESS:
    process.env.FRACTIONAL_PLATFORM_ADMIN_ADDRESS || "179b6b1cb6755e31",
  FRACTIONAL_PLATFORM_ADMIN_KEY:
    process.env.FRACTIONAL_PLATFORM_ADMIN_KEY || "",
  CADENCE_DIR: process.env.CADENCE_DIR || undefined,
};

// Utility: Add 0x prefix to address
function with0x(addr: string | undefined | null): string {
  const a = String(addr || "").trim();
  if (a.length === 0) return "0x";
  return a.startsWith("0x") ? a : `0x${a}`;
}

// Utility: Resolve Cadence directory
function resolveCadenceRoot(): string {
  const fromEnv = ENV.CADENCE_DIR;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv;
  // default when running in container after COPY flow/...
  const containerDefault = path.resolve(process.cwd(), "flow/cadence");
  if (fs.existsSync(containerDefault)) return containerDefault;
  // local dev fallback (repo root relative)
  // Use import.meta.url equivalent for CommonJS
  const currentDir = __dirname || path.dirname(require.main?.filename || "");
  const devFallback = path.resolve(currentDir, "../../../flow/cadence");
  return devFallback;
}

// Utility: Get Cadence code from file
function getCadence(relPath: string): string {
  const root = resolveCadenceRoot();
  const full = path.resolve(root, relPath);
  const raw = fs.readFileSync(full, "utf8");

  // Rewrite standard imports
  const imports: Record<string, string> = {
    Fractional: with0x(ENV.FLOW_CONTRACT_FRACTIONAL),
    FungibleToken: with0x(
      process.env.FLOW_CONTRACT_FUNGIBLETOKEN || "ee82856bf20e2aa6"
    ),
    FungibleTokenConnectors: with0x(
      process.env.FLOW_CONTRACT_FT_CONNECTORS || ENV.FLOW_CONTRACT_FRACTIONAL
    ),
  };

  let code = raw;
  for (const [name, addr] of Object.entries(imports)) {
    code = code.replace(
      new RegExp(`import\\s+["']${name}["']`, "g"),
      `import ${name} from ${addr}`
    );
  }

  return code;
}

// Utility: Alias VaultShareToken import to specific contract
function aliasVaultShareImport(
  code: string,
  contractName: string,
  contractAddress: string
): string {
  // Match: import "VaultShareToken" or import 'VaultShareToken'
  const pattern = /import\s+["']VaultShareToken["']/g;
  const replacement = `import ${contractName} as VaultShareToken from ${with0x(
    contractAddress
  )}`;
  const result = code.replace(pattern, replacement);

  // Verify replacement happened
  if (!result.includes(`import ${contractName} as VaultShareToken`)) {
    console.warn(
      `Warning: VaultShareToken alias not applied. Looking for pattern: ${pattern}`
    );
    console.warn(`Code snippet: ${code.split("\n").slice(0, 10).join("\n")}`);
  }

  return result;
}

// Utility: Set Flow access node
function setAccessNode() {
  const accessUrl = ENV.FLOW_ACCESS.startsWith("http")
    ? ENV.FLOW_ACCESS
    : `http://${ENV.FLOW_ACCESS}`;
  fcl.config().put("accessNode.api", accessUrl);
}

// Utility: Build signing function
function getSigningFunction(addrNo0x: string, pkHex: string, keyIndex: number) {
  return async (signable: any) => {
    if (!pkHex || pkHex.trim().length === 0) {
      throw new Error(
        "FRACTIONAL_PLATFORM_ADMIN_KEY is empty. Set a valid hex private key in env."
      );
    }
    const normalizedPkHex = pkHex.replace(/^0x/, "").toLowerCase();
    if (!/^[0-9a-f]+$/.test(normalizedPkHex)) {
      throw new Error(
        "FRACTIONAL_PLATFORM_ADMIN_KEY must be a hex string (optionally 0x-prefixed)."
      );
    }
    const msg = Buffer.from(signable.message, "hex");
    const hasher = new SHA3(256);
    hasher.update(msg);
    const digest = hasher.digest();
    const EC = (elliptic as unknown as { ec: new (curve: string) => any }).ec;
    const ec = new EC("p256");
    const key = ec.keyFromPrivate(normalizedPkHex, "hex");
    const signature = key.sign(Buffer.from(digest));
    const r = signature.r.toArrayLike(Buffer, "be", 32);
    const s = signature.s.toArrayLike(Buffer, "be", 32);
    const sigHex = Buffer.concat([r, s]).toString("hex");
    return { addr: addrNo0x, keyId: keyIndex, signature: sigHex };
  };
}

// Utility: Build local auth function
function makeLocalAuth(
  addrHexWith0x: string,
  privateKeyHexWith0x: string,
  keyIndex = 0
) {
  const addrNo0x = addrHexWith0x.replace(/^0x/, "");
  const pkHex = privateKeyHexWith0x.replace(/^0x/, "");

  return async (acct: any) => {
    return {
      ...acct,
      tempId: `${addrNo0x}-${keyIndex}`,
      addr: addrNo0x,
      keyId: keyIndex,
      signingFunction: getSigningFunction(addrNo0x, pkHex, keyIndex),
    };
  };
}

// Utility: Get local auth triplet
function getLocalAuthTriplet(
  addrHexWith0x: string,
  privateKeyHexWith0x: string,
  keyIndex = 0
) {
  const auth = makeLocalAuth(addrHexWith0x, privateKeyHexWith0x, keyIndex);
  return {
    proposer: auth as any,
    payer: auth as any,
    authorizations: [auth] as any,
  };
}

// Type: Vault FT metadata
type VaultFTMetadata = {
  contractName: string;
  contractAddress: string;
  storagePath: string;
  receiverPath: string;
  balancePath: string;
  symbol: string;
};

// Fetch vault FT metadata from Fractional contract
async function fetchVaultFTMetadata(vaultId: string): Promise<VaultFTMetadata> {
  setAccessNode();

  // Query Fractional.getVaultFT
  const getVaultFTCode = `
    import Fractional from ${with0x(ENV.FLOW_CONTRACT_FRACTIONAL)}
    
    access(all) fun main(vaultId: String): {String: String}? {
      return Fractional.getVaultFT(vaultId: vaultId)
    }
  `;

  const ftMeta = await fcl.query({
    cadence: getVaultFTCode,
    args: (arg: any, t: any) => [arg(vaultId, t.String)],
  });

  if (!ftMeta) {
    throw new Error("share token metadata missing");
  }

  const metaDict = ftMeta as {
    address?: string;
    name?: string;
    storage?: string;
    receiver?: string;
    balance?: string;
  };

  const contractAddress = metaDict.address;
  const contractName = metaDict.name;
  const storagePath = metaDict.storage;
  const receiverPath = metaDict.receiver;
  const balancePath = metaDict.balance;

  if (
    !contractAddress ||
    !contractName ||
    !storagePath ||
    !receiverPath ||
    !balancePath
  ) {
    throw new Error("share token metadata incomplete");
  }

  // Get symbol
  const getSymbolCode = `
    import Fractional from ${with0x(ENV.FLOW_CONTRACT_FRACTIONAL)}
    
    access(all) fun main(vaultId: String): String {
      let vault = Fractional.getVault(vaultId: vaultId) ?? panic("vault not found")
      return vault.shareSymbol
    }
  `;

  const symbol = (await fcl.query({
    cadence: getSymbolCode,
    args: (arg: any, t: any) => [arg(vaultId, t.String)],
  })) as string;

  return {
    symbol,
    contractName,
    contractAddress: with0x(contractAddress),
    storagePath,
    receiverPath,
    balancePath,
  };
}

// Type: Distribution recipient (amount field kept for DB but ignored in calculations)
type DistributionRecipient = {
  account: string;
  amount: string;
  createdAt?: string | null;
};

// Fetch recipients from Cassandra (addresses only, amounts ignored)
async function listRecipients(
  cassandra: Cassandra,
  params: { network: string; programId: string }
): Promise<DistributionRecipient[]> {
  const q =
    "SELECT account, amount, created_at FROM fractional.distribution_recipients WHERE network=? AND program_id=?";
  const r = await cassandra.execute(q, [params.network, params.programId], {
    prepare: true,
  });
  return r.rows.map((row: { get: (key: string) => unknown }) => ({
    account: row.get("account") as string,
    amount: row.get("amount") as string, // Kept for backward compatibility, ignored in calculations
    createdAt: (row.get("created_at") as Date | null)?.toISOString?.(),
  }));
}

// Fetch distribution totalAmount from Cassandra
async function getDistributionTotalAmount(
  cassandra: Cassandra,
  params: { network: string; programId: string; vaultId: string }
): Promise<string> {
  const q =
    "SELECT total_amount FROM fractional.distributions WHERE network=? AND vault_id=? AND program_id=?";
  const r = await cassandra.execute(
    q,
    [params.network, params.vaultId, params.programId],
    { prepare: true }
  );
  if (r.rows.length === 0) {
    throw new Error(
      `Distribution not found: network=${params.network}, vaultId=${params.vaultId}, programId=${params.programId}`
    );
  }
  const totalAmount = r.rows[0].get("total_amount") as string;
  if (!totalAmount) {
    throw new Error(
      `Distribution totalAmount is missing for programId=${params.programId}`
    );
  }
  return totalAmount;
}

// Execute distribution transaction
async function executeDistribution(
  cassandra: Cassandra,
  programId: string,
  vaultId: string
): Promise<void> {
  setAccessNode();

  // Fetch totalAmount from distribution record
  const totalAmount = await getDistributionTotalAmount(cassandra, {
    network: ENV.NETWORK,
    programId,
    vaultId,
  });

  // Fetch recipients (addresses only, amounts ignored)
  const recipients = await listRecipients(cassandra, {
    network: ENV.NETWORK,
    programId,
  });

  if (recipients.length === 0) {
    console.warn(`No recipients found for program ${programId}`);
    return;
  }

  // Calculate amount per recipient off-chain (for logging/debugging)
  // Note: Cadence will recalculate this from totalAmount / recipients.length
  const totalAmountNum = Number.parseFloat(totalAmount);
  const amountPerRecipient = totalAmountNum / recipients.length;
  console.log(
    `Distribution: ${recipients.length} recipients, totalAmount=${totalAmount}, amountPerRecipient=${amountPerRecipient}`
  );

  // Get vault FT metadata for dynamic import
  const ftMeta = await fetchVaultFTMetadata(vaultId);

  // Prepare transaction code with dynamic import
  let cadence = getCadence("transactions/distributions/scheduler/execute.cdc");

  // Alias VaultShareToken AFTER rewriting other imports
  cadence = aliasVaultShareImport(
    cadence,
    ftMeta.contractName,
    ftMeta.contractAddress
  );

  // Debug: log the first few lines to verify aliasing
  console.log(
    `Distribution execute transaction for vault ${vaultId}:`,
    cadence.split("\n").slice(0, 10).join("\n")
  );

  // Prepare recipients array for Cadence (struct array)
  // Recipient struct now only has: Address: Address (no amount field)
  const recipientsArg = recipients.map((r) => ({
    Address: with0x(r.account).replace(/^0x/, ""), // Remove 0x for Cadence Address
  }));

  // Get admin auth
  const { proposer, payer, authorizations } = getLocalAuthTriplet(
    with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS),
    with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_KEY),
    0
  );

  // Send transaction
  // Recipient struct array: [Recipient] where Recipient only has Address
  // Format for FCL: array of objects with fields array
  const recipientsArray = recipientsArg.map((r) => ({
    fields: [{ name: "Address", value: r.Address }],
  }));

  const txId = await fcl
    .send([
      fcl.transaction(cadence),
      fcl.args([
        fcl.arg(programId, t.String),
        fcl.arg(vaultId, t.String),
        fcl.arg(totalAmount, t.UFix64), // Pass totalAmount as parameter
        (fcl as any).arg(
          recipientsArray,
          (t as any).Array(
            (t as any).Struct([(t as any).Field("Address", t.Address)])
          )
        ),
      ]),
      fcl.proposer(proposer as any),
      fcl.payer(payer as any),
      fcl.authorizations(authorizations as any),
      fcl.limit(9999),
    ])
    .then(fcl.decode);

  console.log(`Distribution executed for program ${programId}, txId: ${txId}`);
}

async function main() {
  console.log("Distributor service starting with env", {
    NETWORK: ENV.NETWORK,
    NATS_URL: ENV.NATS_URL,
    CASSANDRA_CONTACT_POINTS: ENV.CASSANDRA_CONTACT_POINTS,
  });

  // Connect to Cassandra
  const cassandra = new Cassandra({
    contactPoints: ENV.CASSANDRA_CONTACT_POINTS,
    localDataCenter: "datacenter1",
    keyspace: ENV.CASSANDRA_KEYSPACE,
  });

  await cassandra.connect();
  console.log("Connected to Cassandra");

  // Connect to NATS
  const nc = await connect({ servers: ENV.NATS_URL });
  console.log("Connected to NATS");

  // Subscribe to DistributionExecutionTriggered events from normalized stream
  const js = nc.jetstream();
  const jsm = await nc.jetstreamManager();
  const streamName = "FLOW_EVENTS_NORM";

  // Create consumer if it doesn't exist
  try {
    await jsm.consumers.add(streamName, {
      durable_name: "distributor",
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.LastPerSubject,
      ack_wait: 60_000_000_000, // 60 seconds
      filter_subject: `flow.events.norm.${ENV.NETWORK}.distributionhandler.DistributionExecutionTriggered`,
    });
  } catch (e) {
    // Consumer might already exist, ignore
    console.log("Consumer creation skipped (may already exist)");
  }

  const consumer = await js.consumers.get(streamName, "distributor");
  const messages = await consumer.consume({});

  // Listen for DistributionExecutionTriggered events
  (async () => {
    for await (const msg of messages) {
      try {
        const data = JSON.parse(new TextDecoder().decode(msg.data));

        // Check for DistributionExecutionTriggered event type
        if (data.type === "DistributionExecutionTriggered") {
          const payload = data.payload as {
            programId?: string;
            vaultId?: string;
          };

          if (payload.programId && payload.vaultId) {
            console.log(
              `Processing distribution execution for program ${payload.programId}, vault ${payload.vaultId}`
            );
            await executeDistribution(
              cassandra,
              payload.programId,
              payload.vaultId
            );
          }
        }

        msg.ack();
      } catch (e) {
        console.error("Error processing message:", e);
        msg.nak();
      }
    }
  })();

  // Also poll for distributions that should execute (fallback)
  setInterval(async () => {
    try {
      const now = new Date();
      const query = `
        SELECT program_id, vault_id FROM fractional.distributions 
        WHERE network = ? AND starts_at <= ? AND ends_at >= ?
        LIMIT 10
      `;
      const result = await cassandra.execute(query, [ENV.NETWORK, now, now], {
        prepare: true,
      });

      for (const row of result.rows) {
        const programId = row.get("program_id");
        const vaultId = row.get("vault_id");

        // Check if already claimed (executed)
        const claimsQuery = `
          SELECT COUNT(*) as count FROM fractional.claims 
          WHERE network = ? AND program_id = ?
        `;
        const claimsResult = await cassandra.execute(
          claimsQuery,
          [ENV.NETWORK, programId],
          { prepare: true }
        );
        const claimCount = claimsResult.first()?.get("count") || 0;

        // If no claims yet, execute distribution
        if (claimCount === 0) {
          console.log(
            `Polling found distribution ready: program ${programId}, vault ${vaultId}`
          );
          await executeDistribution(cassandra, programId, vaultId);
        }
      }
    } catch (e) {
      console.error("Error in polling loop:", e);
    }
  }, ENV.POLL_INTERVAL_MS);

  console.log("Distributor service ready");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
