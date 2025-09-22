"use client";

import { useFlowClient } from "@onflow/react-sdk";
import { Input } from "@/components/ui/input";
import TxActionButton from "@/app/components/TxActionButton";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { PreparedTxPayload } from "@/types/listings";
import { useQuoteWithFees, useFeeParams } from "@/hooks/useFeeQuotes";
import type { ListingFormState } from "@/hooks/usePreparedListing";
import { useVaultCustodyStatus } from "@/hooks/useVaultCustodyStatus";
import { useFlowCurrentUser } from "@onflow/react-sdk";
import { getWalletBalancesScriptAliased } from "@/lib/tx/scripts";
import NotLoggedIn from "@/components/ui/NotLoggedIn";
// Local minimal type for the transaction config to avoid importing SDK types here
type TxConfig = {
  cadence: string;
  args: (
    arg: (v: unknown, ty: unknown) => unknown,
    t: Record<string, unknown>
  ) => unknown[];
  authorizations: unknown[];
  limit: number;
};

export default function ListingForm({
  form,
  setForm,
  preparedTx,
  canSubmit,
  adminAuth,
  vaultSymbol,
  onStart,
  onSuccess,
  onError,
}: {
  form: ListingFormState;
  setForm: (f: ListingFormState) => void;
  preparedTx: PreparedTxPayload | null;
  canSubmit: boolean;
  userAuth: unknown;
  adminAuth: unknown;
  vaultSymbol: string;
  onStart?: () => void;
  onSuccess?: (txId: string) => void;
  onError?: (e: unknown) => void;
}) {
  const fcl = useFlowClient();
  const params = useParams() as { vaultId?: string };
  const vaultIdParam = String(params?.vaultId || "");
  const { user } = useFlowCurrentUser();

  const userAuth = useMemo(
    () =>
      (
        fcl as unknown as { currentUser(): { authorization: unknown } }
      ).currentUser().authorization,
    [fcl]
  );

  // Use route param vaultId to ensure fee queries/quotes reference the correct vault
  const vaultId: string | undefined = vaultIdParam || undefined;
  const custody = useVaultCustodyStatus(vaultId, fcl);
  const priceAmount = form.priceAmount;
  const { data: quote } = useQuoteWithFees(vaultId, priceAmount);
  const { data: feeParams } = useFeeParams(vaultId as string | undefined);
  const onChainActive =
    typeof feeParams?.feeBps === "number" && feeParams.feeBps > 0;

  const splitVaultBps =
    typeof feeParams?.vaultSplitBps === "number"
      ? feeParams.vaultSplitBps
      : null;
  const splitProtocolBps =
    typeof feeParams?.protocolSplitBps === "number"
      ? feeParams.protocolSplitBps
      : null;
  const feeBps =
    typeof quote?.feeBps === "number"
      ? quote.feeBps
      : typeof feeParams?.feeBps === "number"
      ? feeParams.feeBps
      : 0;
  const feeAmountNum = Number(quote?.feeAmount || 0);
  const vaultFeeAmt =
    splitVaultBps != null ? (feeAmountNum * splitVaultBps) / 10000 : null;
  const protocolFeeAmt =
    splitProtocolBps != null ? (feeAmountNum * splitProtocolBps) / 10000 : null;
  const [createListingPending, setCreateListingPending] = useState(false);

  // Add state for wallet share balance
  const [walletShare, setWalletShare] = useState<string>("0.0");

  // Add useEffect to load wallet share balance
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!user?.addr) return;
        if (!vaultSymbol) return;
        const res = (await (fcl as any).query({
          cadence: await getWalletBalancesScriptAliased(),
          args: (arg: (v: unknown, t: any) => unknown, t: any) => [
            arg(user.addr, t.Address),
            arg(vaultSymbol, t.String),
            arg(null, t.Optional(t.String)),
          ],
        })) as Record<string, string>;
        if (cancelled || !res) return;
        setWalletShare(String(res.share || "0.0"));
      } catch {
        if (!cancelled) {
          setWalletShare("0.0");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.addr, vaultSymbol, fcl]);

  const txConfig: TxConfig | undefined =
    canSubmit && preparedTx
      ? {
          cadence: preparedTx.cadence,
          args: (
            arg: (v: unknown, ty: unknown) => unknown,
            t: Record<string, unknown>
          ) =>
            preparedTx.args.map(({ type, value }) => {
              switch (type) {
                case "Address":
                  return arg(
                    value,
                    (t as unknown as { Address: unknown }).Address
                  );
                case "String":
                  return arg(
                    value,
                    (t as unknown as { String: unknown }).String
                  );
                case "UFix64":
                  return arg(
                    value,
                    (t as unknown as { UFix64: unknown }).UFix64
                  );
                default:
                  throw new Error(`unsupported arg type ${type}`);
              }
            }),
          authorizations: [
            userAuth as unknown as never,
            adminAuth as unknown as never,
          ],
          limit: preparedTx.limit,
        }
      : undefined;

  if (user && !user.loggedIn) {
    return (
      <NotLoggedIn message="Connect your wallet to create a listing." />
    );
  }

  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-neutral-100">
          Listing Details
        </div>
      </div>

      <div className="text-[11px] text-neutral-400 leading-relaxed">
        Set ID, price and amount to create a fixed-price listing.
      </div>

      {user?.addr && (
        <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-2 text-[11px] text-neutral-400 flex gap-4">
          <span>
            Your {vaultSymbol} shares:{" "}
            <span className="text-neutral-100 font-medium">
              {Number(walletShare).toFixed(6)}
            </span>
          </span>
        </div>
      )}

      {!custody.loading && !custody.alive && (
        <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-2 text-xs text-neutral-300 border-l-2 border-l-blue-500/50">
          Vault custody is offline. The underlying NFT was not detected in its
          LockBox. Creating new listings is temporarily disabled until custody
          is restored.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 items-start">
        <div className="space-y-1">
          <div className="text-[11px] text-gray-500 mb-1 font-medium">
            Listing ID
          </div>
          <div className="flex gap-2">
            <Input
              name="listingId"
              placeholder="listing-1"
              className="flex-1"
              value={form.listingId}
              onChange={(e) => setForm({ ...form, listingId: e.target.value })}
            />
            <button
              type="button"
              className="px-3 py-2 text-[11px] border border-neutral-600 rounded bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-300 transition-colors whitespace-nowrap"
              onClick={() => {
                const now = Math.floor(Date.now() / 1000);
                setForm({
                  ...form,
                  listingId: `LS-${String(vaultId || "").slice(0, 6)}-${now}`,
                });
              }}
            >
              Auto
            </button>
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            Use a unique, human-readable identifier.
          </div>
        </div>

        <div className="grid gap-4 grid-cols-2">
          <div className="space-y-1">
            <div className="text-[11px] text-gray-500 mb-1 font-medium">
              Price Asset
            </div>
            <Input
              name="priceAsset"
              placeholder="FLOW"
              className="w-full"
              value={form.priceAsset}
              onChange={(e) =>
                setForm({ ...form, priceAsset: e.target.value.toUpperCase() })
              }
            />
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-gray-500 mb-1 font-medium">
              Price Amount
            </div>
            <Input
              name="priceAmount"
              placeholder="1.0"
              inputMode="decimal"
              className="w-full"
              value={form.priceAmount}
              onChange={(e) =>
                setForm({ ...form, priceAmount: e.target.value })
              }
            />
          </div>
        </div>

        <div className="space-y-1 md:col-span-2">
          <div className="text-[11px] text-gray-500 mb-1 font-medium">
            Amount
          </div>
          <Input
            name="amount"
            placeholder="10.0"
            inputMode="decimal"
            className="w-full"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <div className="text-[11px] text-gray-500 mt-1">
            Number of {vaultSymbol} shares to sell.
          </div>
        </div>
      </div>

      {quote ? (
        <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-3 space-y-2">
          <div className="text-[11px] text-gray-500 font-medium">
            Fees (charged on fill)
          </div>
          <div className="grid gap-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Fee rate:</span>
              <span className="text-neutral-100 font-medium">
                {feeBps} bps
                {onChainActive ? (
                  <span className="text-green-400 ml-1">(Active)</span>
                ) : (
                  <span className="text-amber-400 ml-1">(No schedule)</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Fee amount:</span>
              <span className="text-neutral-100 font-medium">
                {quote.feeAmount} {form.priceAsset || "FLOW"}
              </span>
            </div>
            {vaultFeeAmt != null && protocolFeeAmt != null && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Vault share:</span>
                  <span className="text-neutral-100 font-medium">
                    {vaultFeeAmt.toFixed(8)} {form.priceAsset || "FLOW"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Protocol share:</span>
                  <span className="text-neutral-100 font-medium">
                    {protocolFeeAmt.toFixed(8)} {form.priceAsset || "FLOW"}
                  </span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between pt-1 border-t border-neutral-700">
              <span className="text-neutral-300 font-medium">
                Total you receive:
              </span>
              <span className="text-neutral-100 font-semibold">
                {quote.totalPay} {form.priceAsset || "FLOW"}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-2 text-[11px] text-neutral-400">
          Enter a price and amount to preview fees
        </div>
      )}

      <div className="flex justify-end">
        <TxActionButton
          type="button"
          variant="secondary"
          label={createListingPending ? "Submitting…" : "Create Listing"}
          disabled={
            !canSubmit ||
            createListingPending ||
            custody.loading ||
            !custody.alive
          }
          transaction={txConfig as unknown as never}
          mutation={{
            mutationKey: ["create-listing", vaultId, form.listingId],
            onMutate: () => {
              setCreateListingPending(true);
              onStart?.();
            },
            onSuccess: async (txId: string) => {
              try {
                onSuccess?.(txId);
              } catch (e) {
                onError?.(e);
              }
            },
            onError: (e: unknown) => onError?.(e),
            onSettled: () => setCreateListingPending(false),
          }}
        />
      </div>
    </div>
  );
}
