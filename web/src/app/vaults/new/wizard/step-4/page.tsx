"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCallback, useMemo, useState } from "react";
import { gqlFetch, DEFAULT_NETWORK } from "@/lib/graphql";
import { useFlowAddresses } from "@/app/FlowAddressesContext";

const SHARE_BALANCE_QUERY = `
  query ShareBalance($network: String!, $vaultId: String!, $account: String!) {
    shareBalance(network: $network, vaultId: $vaultId, account: $account) {
      balance
    }
  }
`;

export default function Step4Page() {
  const flowAddrs = useFlowAddresses();
  const [vaultId, setVaultId] = useState("");
  const [maxSupply, setMaxSupply] = useState("");
  const [initialEscrow, setInitialEscrow] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [configureResult, setConfigureResult] = useState<{
    maxSupplyTxId?: string | null;
    mintTxId?: string | null;
  } | null>(null);
  const [supplyBalance, setSupplyBalance] = useState<string | null>(null);

  const apiAdminAddress = useMemo(() => {
    const addr = flowAddrs?.platformAdmin || "";
    if (!addr) return "";
    return addr.startsWith("0x") ? addr : `0x${addr}`;
  }, [flowAddrs?.platformAdmin]);

  const refreshShareBalance = useCallback(async () => {
    try {
      const recipient = apiAdminAddress;
      if (!vaultId || !recipient) return;
      const data = await gqlFetch<{
        shareBalance: { balance: string };
      }>(SHARE_BALANCE_QUERY, {
        network: DEFAULT_NETWORK,
        vaultId,
        account: recipient,
      });
      setSupplyBalance(data.shareBalance.balance);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [apiAdminAddress, vaultId]);

  const configureSupply = useCallback(async () => {
    try {
      if (!vaultId) {
        setError("Vault ID missing");
        return;
      }
      if (!maxSupply && !initialEscrow) {
        setError("Provide max supply and/or escrow amount");
        return;
      }
      setLoading(true);
      const res = await fetch("/api/admin/configure-share-supply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vaultId,
          maxSupply: maxSupply || null,
          escrowAmount: initialEscrow || null,
          escrowRecipient: null,
        }),
      });

      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(error.error || `HTTP error ${res.status}`);
      }

      const result = await res.json();
      setConfigureResult(result);
      setSuccess(
        `Supply configured. maxSupplyTxId=${
          result.maxSupplyTxId ?? "-"
        }, mintTxId=${result.mintTxId ?? "-"}`
      );
      setError(null);
      await refreshShareBalance();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [initialEscrow, maxSupply, refreshShareBalance, vaultId]);

  return (
    <section className="rounded border p-4 space-y-3">
      <div className="font-medium">Step 4 — Share Supply</div>
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded border border-green-300 bg-green-50 p-2 text-sm text-green-700">
          {success}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label htmlFor="vaultId" className="block text-sm mb-1">
            Vault ID
          </label>
          <Input
            id="vaultId"
            className="w-full"
            value={vaultId}
            onChange={(e) => setVaultId(e.target.value)}
            placeholder="e.g. VAULT-001"
          />
        </div>
        <div>
          <label htmlFor="maxSupply" className="block text-sm mb-1">
            Max Supply
          </label>
          <Input
            id="maxSupply"
            className="w-full"
            value={maxSupply}
            onChange={(e) => setMaxSupply(e.target.value)}
            placeholder="optional, e.g. 10000.0"
          />
        </div>
        <div>
          <label htmlFor="initialEscrow" className="block text-sm mb-1">
            Initial Escrow Amount
          </label>
          <Input
            id="initialEscrow"
            className="w-full"
            value={initialEscrow}
            onChange={(e) => setInitialEscrow(e.target.value)}
            placeholder="optional, e.g. 1000.0"
          />
        </div>
      </div>
      {configureResult && (
        <div className="text-xs text-gray-600">
          <div>Max supply tx: {configureResult.maxSupplyTxId ?? "—"}</div>
          <div>Mint tx: {configureResult.mintTxId ?? "—"}</div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label htmlFor="adminEscrowBalance" className="block text-sm mb-1">
            Admin Escrow Balance
          </label>
          <div className="border rounded px-3 py-2 text-sm bg-neutral-900 text-neutral-100 border-neutral-700 font-mono">
            {supplyBalance ?? "—"}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Button asChild variant="outline" size="sm">
          <Link href="/vaults/new/wizard/step-3">Back</Link>
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={loading || (!maxSupply && !initialEscrow)}
          onClick={configureSupply}
          size="sm"
        >
          {loading ? "Submitting..." : "Configure Supply"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={refreshShareBalance}
        >
          Refresh Balance
        </Button>
      </div>
    </section>
  );
}
