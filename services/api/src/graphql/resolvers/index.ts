import type { Client as Cassandra } from "cassandra-driver";
import { z } from "zod";
import {
	getVault,
	listVaults,
	getVaultBySymbol,
	listVaultsByCreator,
} from "../../services/vaults";
import { getShareToken } from "../../services/tokens";
import {
	listListings,
	listListingsBySeller,
	getMarketplaceListings,
	getMarketplaceStats,
} from "../../services/market";
import {
	listPools,
	getPool,
	listPoolsByAsset,
	getPriceTvl,
} from "../../services/pools";
import { listDistributions, listClaims } from "../../services/distributions";
import { listRecipients } from "../../services/recipients";
import { listEvents } from "../../services/events";
import {
	listBalancesByAccount,
	listBalancesByAsset,
	listHoldersByAsset,
} from "../../services/balances";
import { txRegisterVaultFromNFT } from "../../tx/vaults";
import {
	txSetShareMaxSupply,
	txMintShares,
	txMintSharesToTreasury,
	scriptShareBalance,
	txConfigureShareSupply,
} from "../../tx/shares";
import {
	txSetTransferMode,
	txProposeBuyout,
	txVoteBuyout,
	txFinalizeBuyout,
	txScheduleDistribution,
	txClaimPayout,
	txRedeem,
} from "../../tx/governance";
import { txSetupCustody } from "../../tx/custody";
import {
	scriptExampleNFTGetIDs,
	scriptListNftCollections,
	scriptGetCollectionIds,
	scriptListNftStorageCollections,
} from "../../tx/scripts";
import { scriptVaultCustodyStatus } from "../../tx/scripts";

import { with0x } from "../../lib/addr";

import ENV from "../../lib/env";

function isAdminRequest(context: any): boolean {
	try {
		const hdr = (
			context?.reply?.request?.headers?.["x-admin-auth"] || ""
		).toString();

		// SECURITY: Use timing-safe comparison to prevent timing attacks
		// This prevents attackers from using response time differences to brute-force the API key
		if (!hdr || hdr.length === 0) {
			return false;
		}

		// Use crypto.timingSafeEqual for comparison
		// First check length to avoid timing leaks on length mismatches
		const expectedKey = ENV.ADMIN_API_KEY;
		if (hdr.length !== expectedKey.length) {
			return false;
		}

		try {
			return require("crypto").timingSafeEqual(
				Buffer.from(hdr),
				Buffer.from(expectedKey),
			);
		} catch {
			// If comparison fails, return false (keys don't match)
			return false;
		}
	} catch {
		return false;
	}
}

export function buildResolvers(cassandra: Cassandra) {
	const resolvers = {
		Query: {
			async ammFeeParams(
				_: unknown,
				args: { network: string; vaultId: string },
			) {
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
				});
				const { network, vaultId } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { scriptAmmFeeParams } = await import("../../tx/scripts");
				const p = await scriptAmmFeeParams(vaultId);
				return {
					feeBps: p.feeBps,
					vaultSplitBps: p.vaultSplitBps,
					protocolSplitBps: p.protocolSplitBps,
				};
			},
			async vault(
				_: unknown,
				{ network, vaultId }: { network: string; vaultId: string },
			) {
				return await getVault(cassandra, { network, vaultId });
			},
			async vaults(
				_: unknown,
				{ network, limit }: { network: string; limit: number },
			) {
				return await listVaults(cassandra, { network, limit });
			},
			async vaultsByCreator(
				_: unknown,
				{
					network,
					creator,
					limit,
				}: { network: string; creator: string; limit: number },
			) {
				return await listVaultsByCreator(cassandra, {
					network,
					creator,
					limit,
				});
			},
			async buyouts(
				_: unknown,
				{
					network,
					vaultId,
					limit,
				}: { network: string; vaultId: string; limit: number },
			) {
				const { listBuyouts } = await import("../../services/buyouts");
				return await listBuyouts(cassandra, { network, vaultId, limit });
			},
			async shareToken(
				_: unknown,
				{ network, symbol }: { network: string; symbol: string },
			) {
				return await getShareToken(cassandra, { network, symbol });
			},
			async listings(
				_: unknown,
				{
					network,
					vaultId,
					limit,
				}: { network: string; vaultId: string; limit: number },
			) {
				return await listListings(cassandra, { network, vaultId, limit });
			},
			async listingsBySeller(
				_: unknown,
				{
					network,
					seller,
					limit,
				}: { network: string; seller: string; limit: number },
			) {
				return await listListingsBySeller(cassandra, {
					network,
					seller,
					limit,
				});
			},
			async marketplaceListings(
				_: unknown,
				{
					network,
					limit,
					offset,
					sortBy,
					filterByAsset,
					filterByStatus,
				}: {
					network: string;
					limit: number;
					offset: number;
					sortBy: string;
					filterByAsset?: string;
					filterByStatus?: string;
				},
			) {
				return await getMarketplaceListings(cassandra, {
					network,
					limit,
					offset,
					sortBy,
					filterByAsset,
					filterByStatus,
				});
			},
			async marketplaceStats(_: unknown, { network }: { network: string }) {
				return await getMarketplaceStats(cassandra, { network });
			},
			async listing(
				_: unknown,
				args: { network: string; vaultId: string; listingId: string },
			) {
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
					listingId: z.string().min(1),
				});
				const { network, vaultId, listingId } = schema.parse(args);
				const { getListing } = await import("../../services/market");
				return await getListing(cassandra, { network, vaultId, listingId });
			},
			async pools(
				_: unknown,
				{
					network,
					vaultId,
					limit,
				}: { network: string; vaultId: string; limit: number },
			) {
				return await listPools(cassandra, { network, vaultId, limit });
			},
			async allPools(
				_: unknown,
				args: {
					network: string;
					limit?: number;
					offset?: number;
					filterActive?: boolean;
					filterByAsset?: string;
					sortBy?: string;
				},
			) {
				const schema = z.object({
					network: z.string().min(2),
					limit: z.number().int().min(1).max(200).default(50).optional(),
					offset: z.number().int().min(0).default(0).optional(),
					filterActive: z.boolean().optional(),
					filterByAsset: z.string().optional(),
					sortBy: z.string().optional(),
				});
				const parsed = schema.parse(args);
				const { listAllPools } = await import("../../services/pools");
				let rows = await listAllPools(cassandra, {
					network: parsed.network,
					limit: parsed.limit ?? 50,
				});
				if (parsed.filterByAsset) {
					const q = parsed.filterByAsset.toLowerCase();
					rows = rows.filter(
						(r) =>
							String(r.assetA || "")
								.toLowerCase()
								.includes(q) ||
							String(r.assetB || "")
								.toLowerCase()
								.includes(q),
					);
				}
				if (parsed.filterActive) {
					rows = rows.filter(
						(r) => Number(r.reserveA || 0) > 0 || Number(r.reserveB || 0) > 0,
					);
				}
				if (parsed.sortBy) {
					if (parsed.sortBy === "TVL_DESC") {
						rows.sort(
							(a, b) => Number(b.reserveB || 0) - Number(a.reserveB || 0),
						);
					} else if (parsed.sortBy === "VOL24H_DESC") {
						// placeholder: volume not modeled here; keep as-is
					}
				}
				if ((parsed.offset ?? 0) > 0) rows = rows.slice(parsed.offset);
				return rows;
			},
			async distributions(
				_: unknown,
				{
					network,
					vaultId,
					limit,
				}: { network: string; vaultId: string; limit: number },
			) {
				return await listDistributions(cassandra, { network, vaultId, limit });
			},
			async pool(
				_: unknown,
				args: { network: string; vaultId: string; poolId: string },
			) {
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
					poolId: z.string().min(1),
				});
				const { network, vaultId, poolId } = schema.parse(args);
				return await getPool(cassandra, { network, vaultId, poolId });
			},
			async poolsByAsset(
				_: unknown,
				args: { network: string; assetSymbol: string; limit: number },
			) {
				const schema = z.object({
					network: z.string().min(2),
					assetSymbol: z.string().min(1),
					limit: z.number().int().min(1).max(200).default(50),
				});
				const { network, assetSymbol, limit } = schema.parse(args);
				return await listPoolsByAsset(cassandra, {
					network,
					assetSymbol,
					limit,
				});
			},
			async claims(
				_: unknown,
				{
					network,
					programId,
					limit,
				}: { network: string; programId: string; limit: number },
			) {
				return await listClaims(cassandra, { network, programId, limit });
			},
			async distributionRecipients(
				_: unknown,
				{ network, programId }: { network: string; programId: string },
			) {
				return await listRecipients(cassandra, { network, programId });
			},
			async events(
				_: unknown,
				{
					network,
					vaultId,
					limit,
				}: { network: string; vaultId: string; limit: number },
			) {
				return await listEvents(cassandra, { network, vaultId, limit });
			},
			async fees(
				_: unknown,
				{
					network,
					vaultId,
					limit,
				}: { network: string; vaultId: string; limit: number },
			) {
				const { listFees } = await import("../../services/fees");
				return await listFees(cassandra, { network, vaultId, limit });
			},
			async balancesByAsset(
				_: unknown,
				{
					network,
					assetSymbol,
					limit,
				}: { network: string; assetSymbol: string; limit: number },
			) {
				return await listBalancesByAsset(cassandra, {
					network,
					assetSymbol,
					limit,
				});
			},
			async holdersByAsset(
				_: unknown,
				{
					network,
					assetSymbol,
					limit,
				}: { network: string; assetSymbol: string; limit: number },
			) {
				return await listHoldersByAsset(cassandra, {
					network,
					assetSymbol,
					limit,
				});
			},
			async vaultBySymbol(
				_: unknown,
				{ network, symbol }: { network: string; symbol: string },
			) {
				return await getVaultBySymbol(cassandra, { network, symbol });
			},
			async balancesByAccount(
				_: unknown,
				{
					network,
					account,
					limit,
				}: { network: string; account: string; limit: number },
			) {
				return await listBalancesByAccount(cassandra, {
					network,
					account,
					limit,
				});
			},
			async exampleNFTIds(
				_: unknown,
				{ network, account }: { network: string; account: string },
			) {
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				return await scriptExampleNFTGetIDs(account);
			},
			async nftCollections(
				_: unknown,
				{ network, account }: { network: string; account: string },
			) {
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				return await scriptListNftCollections(account);
			},
			async collectionIds(
				_: unknown,
				{
					network,
					account,
					publicPath,
				}: { network: string; account: string; publicPath: string },
			) {
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				return await scriptGetCollectionIds(account, publicPath);
			},
			async nftDisplay(
				_: unknown,
				args: {
					network: string;
					account: string;
					publicPath: string;
					tokenId: string;
				},
			) {
				const schema = z.object({
					network: z.string().min(2),
					account: z.string().min(2),
					publicPath: z.string().min(1),
					tokenId: z.string().regex(/^\d+$/),
				});
				const parsed = schema.parse(args);
				if (parsed.network !== ENV.FLOW_NETWORK)
					throw new Error("network mismatch");
				const { scriptGetNFTDisplay } = await import("../../tx/scripts");
				return await scriptGetNFTDisplay(
					parsed.account,
					parsed.publicPath,
					parsed.tokenId,
				);
			},
			async nftStorageCollections(
				_: unknown,
				{ network, account }: { network: string; account: string },
			) {
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				return await scriptListNftStorageCollections(account);
			},
			async priceTvl(
				_: unknown,
				{
					network,
					symbol,
					quoteSymbol,
				}: { network: string; symbol: string; quoteSymbol?: string },
			) {
				return await getPriceTvl(cassandra, { network, symbol, quoteSymbol });
			},
			async shareBalance(
				_: unknown,
				args: { network: string; vaultId: string; account: string },
			) {
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
					account: z.string().min(2),
				});
				const { network, vaultId, account } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const balance = await scriptShareBalance({ vaultId, account });
				return { balance };
			},
			async vaultMaxSupply(
				_: unknown,
				args: { network: string; vaultId: string },
			) {
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
				});
				const { network, vaultId } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { scriptVaultMaxSupply } = await import("../../tx/shares");
				return await scriptVaultMaxSupply(vaultId);
			},
			async vaultTotalSupply(
				_: unknown,
				args: { network: string; vaultId: string },
			) {
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
				});
				const { network, vaultId } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { scriptVaultTotalSupply } = await import("../../tx/shares");
				return await scriptVaultTotalSupply(vaultId);
			},
			async feeParams(_: unknown, args: { network: string; vaultId: string }) {
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
				});
				const { network, vaultId } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { scriptFeeParams } = await import("../../tx/scripts");
				const p = await scriptFeeParams(vaultId);
				if (!p) return null;
				return {
					feeBps: p.feeBps,
					vaultSplitBps: p.vaultSplitBps,
					protocolSplitBps: p.protocolSplitBps,
				};
			},
			async pendingFeeParams(
				_: unknown,
				args: { network: string; vaultId: string },
			) {
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
				});
				const { network, vaultId } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { scriptPendingFeeParams } = await import("../../tx/scripts");
				const p = await scriptPendingFeeParams(vaultId);
				if (!p) return null;
				return {
					feeBps: p.feeBps,
					vaultSplitBps: p.vaultSplitBps,
					protocolSplitBps: p.protocolSplitBps,
					effectiveAt: String(p.effectiveAt),
				};
			},
			async feeSchedule(
				_: unknown,
				args: { network: string; vaultId: string },
			) {
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
				});
				const { network, vaultId } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { scriptFeeParams, scriptPendingFeeParams } = await import(
					"../../tx/scripts"
				);
				const cur = await scriptFeeParams(vaultId);
				const pen = await scriptPendingFeeParams(vaultId);
				return {
					current: cur
						? {
								feeBps: cur.feeBps,
								vaultSplitBps: cur.vaultSplitBps,
								protocolSplitBps: cur.protocolSplitBps,
							}
						: null,
					pending: pen
						? {
								feeBps: pen.feeBps,
								vaultSplitBps: pen.vaultSplitBps,
								protocolSplitBps: pen.protocolSplitBps,
								effectiveAt: String(pen.effectiveAt),
							}
						: null,
				};
			},
			async feeTotals(_: unknown, args: { network: string; token: string }) {
				const schema = z.object({
					network: z.string().min(2),
					token: z.string().min(1),
				});
				const { network, token } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const q =
					"SELECT amount_total, vault_total, protocol_total, updated_at FROM fractional.fee_totals WHERE network=? AND token=?";
				const r = await cassandra.execute(q, [network, token], {
					prepare: true,
				});
				const row = r.first();
				if (!row)
					return {
						token,
						amountTotal: "0",
						vaultTotal: "0",
						protocolTotal: "0",
						updatedAt: new Date(0).toISOString(),
					};
				return {
					token,
					amountTotal: String(row.get("amount_total") ?? "0"),
					vaultTotal: String(row.get("vault_total") ?? "0"),
					protocolTotal: String(row.get("protocol_total") ?? "0"),
					updatedAt:
						(row.get("updated_at") as Date | null)?.toISOString?.() ??
						new Date(0).toISOString(),
				};
			},
			async platformFeesBalance(_: unknown, args: { network: string }) {
				const schema = z.object({ network: z.string().min(2) });
				const { network } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { scriptPlatformFeesBalance } = await import("../../tx/scripts");
				const bal = await scriptPlatformFeesBalance();
				return bal;
			},
			async platformTreasuryBalance(_: unknown, args: { network: string }) {
				const schema = z.object({ network: z.string().min(2) });
				const { network } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { scriptPlatformTreasuryBalance } = await import(
					"../../tx/scripts"
				);
				const bal = await scriptPlatformTreasuryBalance();
				return bal;
			},
			async vaultTreasuryBalance(
				_: unknown,
				args: { network: string; vaultId: string },
			) {
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
				});
				const { network, vaultId } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { scriptVaultTreasuryBalance } = await import("../../tx/scripts");
				return await scriptVaultTreasuryBalance(vaultId);
			},
			async vaultTreasuryShareBalance(
				_: unknown,
				args: { network: string; vaultId: string },
			) {
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
				});
				const { network, vaultId } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { scriptVaultTreasuryShareBalance } = await import(
					"../../tx/scripts"
				);
				return await scriptVaultTreasuryShareBalance(vaultId);
			},
			async vaultEscrowBalance(
				_: unknown,
				args: { network: string; vaultId: string },
			) {
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
				});
				const { network, vaultId } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				// Use same logic as the wizard: admin address + shareBalance query
				const { scriptShareBalance } = await import("../../tx/shares");
				const bal = await scriptShareBalance({
					vaultId,
					account: with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS),
				});
				return bal;
			},
			async vaultLockedSeedShares(
				_: unknown,
				args: { network: string; vaultId: string },
			) {
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
				});
				const { network, vaultId } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				// Sum AMM LiquidityAdded events where provider == platform admin AND LP was burned by SeedLiquidity
				const { listEvents } = await import("../../services/events");
				const rows = await listEvents(cassandra, {
					network,
					vaultId,
					limit: 1000,
				});
				const admin = with0x(
					ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS,
				).toLowerCase();
				let sum = 0;
				for (const ev of rows) {
					if (ev.type !== "LiquidityAdded") continue;
					try {
						const p = JSON.parse(String(ev.payload || "{}")) as Record<
							string,
							unknown
						>;
						const provider = String(p.provider ?? "").toLowerCase();
						const amountShare = Number.parseFloat(
							String((p as any).amountShare ?? "0"),
						);
						// Heuristic: SeedLiquidity mints LP and immediately destroys; indexer lacks explicit LP-burn events, so
						// we attribute admin LiquidityAdded as permanently locked seed.
						if (provider === admin && Number.isFinite(amountShare))
							sum += amountShare;
					} catch {}
				}
				return String(sum);
			},
			async vaultTeamShareBalances(
				_: unknown,
				args: { network: string; vaultId: string },
			) {
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
				});
				const { network, vaultId } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const team = (ENV.TEAM_ADDRESSES || []).map((a) => with0x(a));
				if (!team.length) return "0.0";
				const { scriptShareBalance } = await import("../../tx/shares");
				let sum = 0;
				for (const acct of team) {
					try {
						const bal = await scriptShareBalance({ vaultId, account: acct });
						const n = Number.parseFloat(bal || "0");
						if (Number.isFinite(n)) sum += n;
					} catch {}
				}
				return String(sum);
			},
			async vaultTeamLPShareEquivalent(
				_: unknown,
				args: { network: string; vaultId: string },
			) {
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
				});
				const { network, vaultId } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const team = (ENV.TEAM_ADDRESSES || []).map((a) => with0x(a));
				if (!team.length) return "0.0";
				const { listPools } = await import("../../services/pools");
				const { scriptTeamLPShareEquivalent } = await import(
					"../../tx/scripts"
				);
				const pools = await listPools(cassandra, {
					network,
					vaultId,
					limit: 100,
				});
				if (!pools?.length) return "0.0";
				let sumEq = 0;
				for (const p of pools) {
					const ownerGuess =
						(p as { owner?: string }).owner ||
						ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS;
					try {
						const eq = await scriptTeamLPShareEquivalent({
							poolOwner: with0x(ownerGuess),
							poolId: p.poolId,
							team,
						});
						const n = Number.parseFloat(eq || "0");
						if (Number.isFinite(n)) sumEq += n;
					} catch {}
				}
				return String(sumEq);
			},
			async vaultCirculating(
				_: unknown,
				args: { network: string; vaultId: string },
			) {
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
				});
				const { network, vaultId } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { scriptVaultTotalSupply } = await import("../../tx/shares");
				const total = Number.parseFloat(
					(await scriptVaultTotalSupply(vaultId)) || "0",
				);
				const { scriptShareBalance } = await import("../../tx/shares");
				const adminBal = Number.parseFloat(
					(await scriptShareBalance({
						vaultId,
						account: with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS),
					})) || "0",
				);
				const lockedSeedStr = await (
					resolvers.Query as any
				).vaultLockedSeedShares(_, { network, vaultId });
				const teamBalStr = await (
					resolvers.Query as any
				).vaultTeamShareBalances(_, { network, vaultId });
				const teamLpEqStr = await (
					resolvers.Query as any
				).vaultTeamLPShareEquivalent(_, { network, vaultId });
				const lockedSeed = Number.parseFloat(String(lockedSeedStr || "0"));
				const teamBal = Number.parseFloat(String(teamBalStr || "0"));
				const teamLpEq = Number.parseFloat(String(teamLpEqStr || "0"));
				const circ = Math.max(
					total - adminBal - lockedSeed - teamBal - teamLpEq,
					0,
				);
				return String(circ);
			},
			async vaultNftDisplay(
				_: unknown,
				args: { network: string; vaultId: string },
			) {
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
				});
				const { network, vaultId } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { scriptVaultLockBoxDisplay } = await import("../../tx/scripts");
				try {
					return await scriptVaultLockBoxDisplay(vaultId);
				} catch (e) {
					console.error("scriptVaultLockBoxDisplay error", e);
					return null;
				}
			},
			async symbolAvailable(
				_: unknown,
				{ network, symbol }: { network: string; symbol: string },
			) {
				const schema = z.object({
					network: z.string().min(2),
					symbol: z.string().regex(/^[A-Z0-9_]{3,16}$/),
				});
				const parsed = schema.parse({ network, symbol });
				if (parsed.network !== ENV.FLOW_NETWORK)
					throw new Error("network mismatch");
				const sym = parsed.symbol.toUpperCase();
				const { scriptVaultIdBySymbol } = await import("../../tx/scripts");
				const existing = await scriptVaultIdBySymbol(sym);
				return { available: !existing } as const;
			},
			async vaultIdAvailable(
				_: unknown,
				{ network, vaultId }: { network: string; vaultId: string },
			) {
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().regex(/^[A-Za-z0-9_-]{3,32}$/),
				});
				const parsed = schema.parse({ network, vaultId });
				if (parsed.network !== ENV.FLOW_NETWORK)
					throw new Error("network mismatch");
				const { scriptVaultIdExists } = await import("../../tx/scripts");
				const exists = await scriptVaultIdExists(parsed.vaultId);
				return { available: !exists } as const;
			},
			async quoteWithFees(
				_: unknown,
				args: { network: string; priceAmount: string; vaultId: string },
			) {
				const schema = z.object({
					network: z.string().min(2),
					priceAmount: z.string().regex(/^[0-9]+(?:\.[0-9]+)?$/),
					vaultId: z.string().min(1),
				});
				const { network, priceAmount, vaultId } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { scriptQuoteFees } = await import("../../tx/scripts");
				const splits = await scriptQuoteFees(vaultId, priceAmount);
				const feeBps = Number(splits.feeBps || 0);
				const priceNum = Number(priceAmount);
				const feeNum = Number(splits.feeAmount || 0);
				const totalPay = (priceNum + feeNum).toString();
				return { priceAmount, feeAmount: String(feeNum), totalPay, feeBps };
			},
			async ammQuote(
				_: unknown,
				args: {
					network: string;
					poolOwner: string;
					poolId: string;
					direction: string;
					amountIn: string;
				},
			) {
				const schema = z.object({
					network: z.string().min(2),
					poolOwner: z.string().min(2),
					poolId: z.string().min(1),
					direction: z.enum(["share_to_flow", "flow_to_share"]),
					amountIn: z.string().regex(/^[0-9]+(?:\.[0-9]+)?$/),
				});
				const parsed = schema.parse(args);
				if (parsed.network !== ENV.FLOW_NETWORK)
					throw new Error("network mismatch");
				const { scriptAmmQuoteViaActions } = await import("../../tx/scripts");
				const res = await scriptAmmQuoteViaActions({
					poolOwner: parsed.poolOwner,
					poolId: parsed.poolId,
					direction: parsed.direction,
					amountIn: parsed.amountIn,
				});
				return { in: res.in, out: res.out };
			},
			async ammQuoteWithFees(
				_: unknown,
				args: {
					network: string;
					poolOwner: string;
					poolId: string;
					direction: string;
					amountIn: string;
					vaultId: string;
				},
			) {
				const schema = z.object({
					network: z.string().min(2),
					poolOwner: z.string().min(2),
					poolId: z.string().min(1),
					direction: z.enum(["share_to_flow", "flow_to_share"]),
					amountIn: z.string().regex(/^[0-9]+(?:\.[0-9]+)?$/),
					vaultId: z.string().min(1),
				});
				const parsed = schema.parse(args);
				if (parsed.network !== ENV.FLOW_NETWORK)
					throw new Error("network mismatch");
				const { scriptAmmQuoteWithFees } = await import("../../tx/scripts");
				const res = await scriptAmmQuoteWithFees({
					poolOwner: parsed.poolOwner,
					poolId: parsed.poolId,
					direction: parsed.direction as any,
					amountIn: parsed.amountIn,
					vaultId: parsed.vaultId,
				});
				return res;
			},
		},
		Vault: {
			async custodyAlive(parent: { network: string; vaultId: string }) {
				// Uses on-chain script deriving custodian from vault metadata
				try {
					return await scriptVaultCustodyStatus(parent.vaultId);
				} catch {
					return false;
				}
			},
			async nftDisplay(parent: { network: string; vaultId: string }) {
				try {
					const { scriptVaultLockBoxDisplay } = await import(
						"../../tx/scripts"
					);
					return await scriptVaultLockBoxDisplay(parent.vaultId);
				} catch {
					return null;
				}
			},
		},
		Mutation: {
			async mintExampleNFT(
				_: unknown,
				args: {
					network: string;
					recipient: string;
					name?: string;
					description?: string;
					thumbnail?: string;
				},
			) {
				const schema = z.object({
					network: z.string().min(2),
					recipient: z.string().min(2),
					name: z.string().optional(),
					description: z.string().optional(),
					thumbnail: z.string().optional(),
				});
				const { network, recipient, name, description, thumbnail } =
					schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { txId } = {
					txId: await (await import("../../tx/scripts")).txMintExampleNFTTo({
						recipient,
						name,
						description,
						thumbnail,
					}),
				};
				return { txId };
			},
			async registerVaultFromNFT(
				_: unknown,
				args: {
					network: string;
					vaultId: string;
					collectionStoragePath: string;
					collectionPublicPath: string;
					tokenId: string;
					shareSymbol: string;
					policy: string;
					creator: string;
				},
			) {
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().regex(/^[A-Za-z0-9_-]{3,32}$/),
					collectionStoragePath: z.string().min(1),
					collectionPublicPath: z.string().min(1),
					tokenId: z.string().regex(/^\d+$/),
					shareSymbol: z.string().regex(/^[A-Z0-9_]{3,16}$/),
					policy: z.string().min(1),
					creator: z.string().min(2),
				});
				const parsed = schema.parse(args);
				if (parsed.network !== ENV.FLOW_NETWORK)
					throw new Error("network mismatch");
				const sym = parsed.shareSymbol.toUpperCase();
				// Preflight uniqueness checks to avoid Cadence precondition failures
				const { scriptVaultIdExists, scriptVaultIdBySymbol } = await import(
					"../../tx/scripts"
				);
				if (await scriptVaultIdExists(parsed.vaultId)) {
					throw new Error("vaultId is already taken");
				}
				if ((await scriptVaultIdBySymbol(sym)) != null) {
					throw new Error("share symbol is already taken");
				}
				const txId = await txRegisterVaultFromNFT({
					vaultId: parsed.vaultId,
					collectionStoragePath: parsed.collectionStoragePath,
					collectionPublicPath: parsed.collectionPublicPath,
					tokenId: parsed.tokenId,
					shareSymbol: sym,
					policy: parsed.policy,
					creator: parsed.creator,
				});
				// After successful vault registration, auto-setup per‑vault share token and treasuries (FLOW + share token)
				try {
					const { txAutosetupVaultFT } = await import("../../tx/vaults");
					const contractName = `VaultShareToken_${sym.replace(
						/[^A-Za-z0-9_]/g,
						"_",
					)}`;
					await txAutosetupVaultFT({
						vaultId: parsed.vaultId,
						contractName,
						name: `Vault ${parsed.vaultId} Share Token`,
						symbol: sym,
						decimals: 8,
						maxSupply: null,
					});
					// Idempotent treasury ensure for FLOW and the per‑vault share token
					try {
						const { txEnsureVaultReady } = await import("../../tx/treasury");
						const { fetchShareMetadata } = await import("../../tx/shares");
						const meta = await fetchShareMetadata(parsed.vaultId);
						await txEnsureVaultReady({
							vaultId: parsed.vaultId,
							shareTokenIdent: meta.contractName,
							shareTokenAddress: meta.contractAddress,
						});
					} catch (_e) {
						// Non-fatal; vault will still be operational, ops can recover
					}
				} catch (e) {
					console.warn(
						"autosetup share token/treasuries failed:",
						(e as Error).message,
					);
				}
				return { txId };
			},
			async setVaultMaxSupply(
				_parent: unknown,
				args: { network: string; vaultId: string; maxSupply: string },
				context: unknown,
			) {
				if (!isAdminRequest(context)) throw new Error("unauthorized");
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
					maxSupply: z.string().regex(/^[0-9]+(?:\.[0-9]+)?$/),
				});
				const { network, vaultId, maxSupply } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { txId } = await txSetShareMaxSupply({ vaultId, maxSupply });
				return { txId };
			},
			async mintShares(
				_parent: unknown,
				args: {
					network: string;
					vaultId: string;
					recipient: string;
					amount: string;
				},
				context: unknown,
			) {
				if (!isAdminRequest(context)) throw new Error("unauthorized");
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
					recipient: z.string().min(2),
					amount: z.string().regex(/^[0-9]+(?:\.[0-9]+)?$/),
				});
				const { network, vaultId, recipient, amount } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { txId } = await txMintShares({ vaultId, recipient, amount });
				return { txId };
			},
			async mintSharesToTreasury(
				_parent: unknown,
				args: {
					network: string;
					vaultId: string;
					amount: string;
				},
				context: unknown,
			) {
				if (!isAdminRequest(context)) throw new Error("unauthorized");
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
					amount: z.string().regex(/^[0-9]+(?:\.[0-9]+)?$/),
				});
				const { network, vaultId, amount } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { txId } = await txMintSharesToTreasury({ vaultId, amount });
				return { txId };
			},
			async configureShareSupply(
				_parent: unknown,
				args: {
					network: string;
					vaultId: string;
					maxSupply?: string | null;
					escrowAmount?: string | null;
					escrowRecipient?: string | null;
				},
				context: unknown,
			) {
				if (!isAdminRequest(context)) throw new Error("unauthorized");
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
					maxSupply: z.string().optional().nullable(),
					escrowAmount: z.string().optional().nullable(),
					escrowRecipient: z.string().optional().nullable(),
				});
				const parsed = schema.parse(args);
				if (parsed.network !== ENV.FLOW_NETWORK) {
					throw new Error("network mismatch");
				}
				const result = await txConfigureShareSupply({
					vaultId: parsed.vaultId,
					maxSupply: parsed.maxSupply ?? null,
					escrowAmount: parsed.escrowAmount ?? null,
					escrowRecipient: parsed.escrowRecipient ?? null,
				});
				return result;
			},
			async setTransferMode(
				_parent: unknown,
				args: { network: string; symbol: string; mode: string },
				context: unknown,
			) {
				if (!isAdminRequest(context)) throw new Error("unauthorized");
				const schema = z.object({
					network: z.string().min(2),
					symbol: z.string().min(1),
					mode: z.string().min(1),
				});
				const { network, symbol, mode } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { txId } = await txSetTransferMode({ symbol, mode });
				return { txId };
			},
			// Removed: proposeBuyout and voteBuyout are client-signed via web tx builders
			async finalizeBuyout(
				_: unknown,
				args: {
					network: string;
					vaultId: string;
					proposalId: string;
					result: string;
				},
			) {
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
					proposalId: z.string().min(1),
					result: z.string().min(1),
				});
				const { network, vaultId, proposalId, result } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { txId } = await txFinalizeBuyout({
					vaultId,
					proposalId,
					result,
				});
				return { txId };
			},
			async scheduleDistribution(
				_parent: unknown,
				args: {
					network: string;
					vaultId: string;
					programId: string;
					asset: string;
					totalAmount: string;
					schedule: string;
					startsAt: string;
					endsAt: string;
				},
				context: unknown,
			) {
				if (!isAdminRequest(context)) throw new Error("unauthorized");
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
					programId: z.string().min(1),
					asset: z.string().min(1),
					totalAmount: z.string().regex(/^\d+(?:\.\d+)?$/),
					schedule: z.string().min(1),
					startsAt: z.string().regex(/^\d+$/),
					endsAt: z.string().regex(/^\d+$/),
				});
				const {
					network,
					vaultId,
					programId,
					asset,
					totalAmount,
					schedule,
					startsAt,
					endsAt,
				} = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { txId } = await txScheduleDistribution({
					vaultId,
					programId,
					asset,
					totalAmount,
					schedule,
					startsAt,
					endsAt,
				});
				return { txId };
			},
			async claimPayout(
				_: unknown,
				args: { network: string; programId: string; amount: string },
			) {
				const schema = z.object({
					network: z.string().min(2),
					programId: z.string().min(1),
					amount: z.string().regex(/^\d+(?:\.\d+)?$/),
				});
				const { network, programId, amount } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { txId } = await txClaimPayout({ programId, amount });
				return { txId };
			},
			async redeem(_: unknown, args: { network: string; vaultId: string }) {
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
				});
				const { network, vaultId } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { txId } = await txRedeem({ vaultId });
				return { txId };
			},
			async scheduleFeeActivation(
				_parent: unknown,
				args: { network: string; vaultId: string },
				context: unknown,
			) {
				if (!isAdminRequest(context)) throw new Error("unauthorized");
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
				});
				const { network, vaultId } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { txScheduleFeeActivation } = await import("../../tx/scripts");
				const txId = await txScheduleFeeActivation({ vaultId });
				return { txId };
			},
			async scheduleFeeParams(
				_parent: unknown,
				args: {
					network: string;
					vaultId: string;
					feeBps: number;
					vaultSplitBps: number;
					protocolSplitBps: number;
					effectiveAt: string;
				},
				context: unknown,
			) {
				if (!isAdminRequest(context)) throw new Error("unauthorized");
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
					feeBps: z.number().int().min(0).max(10000),
					vaultSplitBps: z.number().int().min(0).max(10000),
					protocolSplitBps: z.number().int().min(0).max(10000),
					effectiveAt: z.string().regex(/^[0-9]+$/),
				});
				const {
					network,
					vaultId,
					feeBps,
					vaultSplitBps,
					protocolSplitBps,
					effectiveAt,
				} = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { txScheduleFeeParams } = await import("../../tx/scripts");
				const txId = await txScheduleFeeParams({
					vaultId,
					feeBps,
					vaultSplitBps,
					protocolSplitBps,
					effectiveAt: Number(effectiveAt),
				});
				return { txId };
			},
			async ensureVaultTreasury(
				_parent: unknown,
				args: { network: string; vaultId: string },
				context: unknown,
			) {
				if (!isAdminRequest(context)) throw new Error("unauthorized");
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
				});
				const { network, vaultId } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");

				// Fetch share token metadata to get contract name and address for platform treasury
				let shareTokenIdent: string | null = null;
				let shareTokenAddress: string | null = null;
				try {
					const { fetchShareMetadata } = await import("../../tx/shares");
					const meta = await fetchShareMetadata(vaultId);
					shareTokenIdent = meta.contractName;
					shareTokenAddress = meta.contractAddress;
				} catch (e) {
					// If share token metadata doesn't exist, we'll only ensure FLOW treasuries
					console.warn(
						`Could not fetch share token metadata for vault ${vaultId}:`,
						(e as Error).message,
					);
				}

				const { txEnsureVaultReady } = await import("../../tx/treasury");

				// If we have share token metadata, ensure both treasuries
				// Otherwise, only ensure FLOW treasury
				if (shareTokenIdent && shareTokenAddress) {
					const { flowTreasuryTxId } = await txEnsureVaultReady({
						vaultId,
						shareTokenIdent,
						shareTokenAddress,
					});
					return { txId: flowTreasuryTxId };
				}
				// Only ensure FLOW treasury
				const { txEnsureFlowTreasuries } = await import("../../tx/treasury");
				const flowTreasuryTxId = await txEnsureFlowTreasuries({
					vaultId,
				});
				return { txId: flowTreasuryTxId };
			},
			async settleListing(
				_: unknown,
				args: {
					network: string;
					vaultId: string;
					listingId: string;
					buyer: string;
					symbol: string;
					shareAmount: string;
					priceAmount: string;
					seller: string;
				},
			) {
				const schema = z.object({
					network: z.string().min(2),
					vaultId: z.string().min(1),
					listingId: z.string().min(1),
					buyer: z.string().min(2),
					symbol: z.string().min(1),
					shareAmount: z.string().regex(/^[0-9]+(?:\.[0-9]+)?$/),
					priceAmount: z.string().regex(/^[0-9]+(?:\.[0-9]+)?$/),
					seller: z.string().min(2),
				});
				const parsed = schema.parse(args);
				if (parsed.network !== ENV.FLOW_NETWORK)
					throw new Error("network mismatch");
				// JIT ensure treasuries are ready before settlement (idempotent)
				try {
					const fclMod = await import("@onflow/fcl");
					const accessUrl = ENV.FLOW_ACCESS.startsWith("http")
						? ENV.FLOW_ACCESS
						: `http://${ENV.FLOW_ACCESS}`;
					fclMod.config().put("accessNode.api", accessUrl);
					const code = `
            import Fractional from ${with0x(ENV.FLOW_CONTRACT_FRACTIONAL)}
            access(all) view fun main(vaultId: String): {String: String}? {
              return Fractional.getVaultFT(vaultId: vaultId)
            }
          `;
					const ft = (await fclMod.query({
						cadence: code,
						args: (arg: any, t: any) => [arg(parsed.vaultId, t.String)],
					})) as { address?: string; name?: string } | null;
					if (ft?.address && ft?.name) {
						const { txEnsureVaultReady } = await import("../../tx/treasury");
						await txEnsureVaultReady({
							vaultId: parsed.vaultId,
							shareTokenIdent: String(ft.name),
							shareTokenAddress: with0x(String(ft.address)),
						});
					} else {
						const { txEnsureFlowTreasuries } = await import(
							"../../tx/treasury"
						);
						await txEnsureFlowTreasuries({ vaultId: parsed.vaultId });
					}
				} catch {
					// Non-fatal; settlement may still succeed if already ready
				}
				const { txSettleListing } = await import("../../tx/listings");
				const txId = await txSettleListing({
					vaultId: parsed.vaultId,
					listingId: parsed.listingId,
					buyer: with0x(parsed.buyer),
					shareAmount: parsed.shareAmount,
					priceAmount: parsed.priceAmount,
					seller: with0x(parsed.seller),
				});
				return { txId };
			},
			// Removed: seedLiquidity is client-signed via wallet AddLiquidity

			async setupCustody(_: unknown, args: { network: string }) {
				const schema = z.object({ network: z.string().min(2) });
				const { network } = schema.parse(args);
				if (network !== ENV.FLOW_NETWORK) throw new Error("network mismatch");
				const { txId } = await txSetupCustody();
				return { txId };
			},
		},
	} as const;
	return resolvers;
}

export default buildResolvers;
