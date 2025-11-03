"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import NumericInput from "@/components/form/NumericInput";
import { Button } from "@/components/ui/button";
import { mintSharesToTreasury } from "@/lib/api/shares";

interface MintSharesCardProps {
  vaultId: string;
  vaultSymbol: string;
  maxSupply: string | null;
  currentSupply: string | null;
  onSuccess: () => void;
}

export default function MintSharesCard({
  vaultId,
  vaultSymbol,
  maxSupply,
  currentSupply,
  onSuccess,
}: MintSharesCardProps) {
  const [amount, setAmount] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Calculate available mintable amount
  const maxSupplyNum = maxSupply ? Number.parseFloat(maxSupply) : null;
  const currentSupplyNum = currentSupply ? Number.parseFloat(currentSupply) : 0;
  const availableMint =
    maxSupplyNum !== null ? maxSupplyNum - currentSupplyNum : null;

  // Smart default suggestion: 1000 shares or available amount if less
  const suggestedAmount =
    availableMint !== null && availableMint < 1000
      ? availableMint.toString()
      : "1000";

  const handleMint = async () => {
    if (!amount || Number.parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    const amountNum = Number.parseFloat(amount);
    if (Number.isNaN(amountNum) || !Number.isFinite(amountNum)) {
      setError("Please enter a valid amount");
      return;
    }

    // Format amount to always include decimal point for UFix64
    // Convert "1" to "1.0", "100" to "100.0", etc.
    const formattedAmount =
      amountNum % 1 === 0 ? `${amountNum}.0` : amountNum.toString();

    // Validate against max supply
    if (maxSupplyNum !== null) {
      if (currentSupplyNum + amountNum > maxSupplyNum) {
        setError(
          `Minting ${amount} would exceed max supply of ${maxSupplyNum}. Current supply: ${currentSupplyNum}`
        );
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const { txId } = await mintSharesToTreasury(vaultId, formattedAmount);
      setSuccess(
        `Shares minted to vault treasury successfully! Transaction: ${txId}`
      );
      setAmount("");
      onSuccess();
    } catch (e) {
      setError((e as Error).message || "Failed to mint shares");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3 space-y-3">
      {/* Supply Information */}
      <div className="text-xs text-neutral-500 space-y-1">
        {maxSupplyNum !== null ? (
          <>
            <div>
              Max supply:{" "}
              <span className="text-neutral-200">
                {maxSupplyNum.toFixed(2)}
              </span>
            </div>
            <div>
              Current supply:{" "}
              <span className="text-neutral-200">
                {currentSupplyNum.toFixed(2)}
              </span>
            </div>
            {availableMint !== null && availableMint > 0 && (
              <div>
                Available to mint:{" "}
                <span className="text-neutral-200 font-medium">
                  {availableMint.toFixed(2)} {vaultSymbol}
                </span>
              </div>
            )}
            {availableMint !== null && availableMint <= 0 && (
              <div className="text-red-400">
                Max supply reached. Cannot mint more shares.
              </div>
            )}
          </>
        ) : (
          <div>No max supply limit set</div>
        )}
      </div>

      {/* Mint Form */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-neutral-200">
          Mint shares
        </div>
        <div className="flex flex-wrap gap-2 items-center text-xs">
          <NumericInput
            placeholder="Amount (eg 100.00)"
            value={amount}
            onValueChange={(v) => {
              setAmount(v);
              setError(null);
            }}
            className="w-48"
            decimals={8}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleMint}
            disabled={
              submitting ||
              !amount ||
              Number.parseFloat(amount) <= 0 ||
              (availableMint !== null &&
                Number.parseFloat(amount) > availableMint)
            }
          >
            {submitting ? "Minting…" : "Mint Shares"}
          </Button>
          {error && <span className="text-red-500 text-xs">{error}</span>}
          {success && <span className="text-green-500 text-xs">{success}</span>}
        </div>
        {availableMint !== null && availableMint > 0 && (
          <div className="text-[11px] text-neutral-500">
            Suggested: {suggestedAmount} {vaultSymbol} (or enter custom amount)
          </div>
        )}
      </div>
    </div>
  );
}
