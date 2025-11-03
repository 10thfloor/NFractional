"use client";

import { useEffect, useState } from "react";
import { useFlowClient } from "@onflow/react-sdk";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTransactionStatusModal } from "@/app/TransactionStatusContext";
import { useTransactionStatus } from "@/lib/tx/utils";
import { Copy, Check, ExternalLink, Loader2 } from "lucide-react";
import { DEFAULT_NETWORK } from "@/lib/graphql";

const STATUS_COLORS = {
  PENDING: "text-yellow-400",
  EXECUTED: "text-blue-400",
  SEALED: "text-green-400",
  FINALIZED: "text-green-500",
  EXPIRED: "text-red-400",
} as const;

const STATUS_LABELS = {
  PENDING: "Pending",
  EXECUTED: "Executed",
  SEALED: "Sealed",
  FINALIZED: "Finalized",
  EXPIRED: "Expired",
} as const;

function getExplorerUrl(txId: string, network: string): string {
  const baseUrls: Record<string, string> = {
    testnet: "https://testnet.flowscan.io/tx",
    mainnet: "https://flowscan.io/tx",
    emulator: "#", // No explorer for emulator
  };
  return `${baseUrls[network] || baseUrls.testnet}/${txId}`;
}

export default function TransactionStatusModal() {
  const fcl = useFlowClient();
  const { currentTxId, closeTransaction } = useTransactionStatusModal();
  const { status, error } = useTransactionStatus(fcl, currentTxId);
  const [copied, setCopied] = useState(false);

  const open = Boolean(currentTxId);

  // Auto-close when sealed/finalized (optional - remove if you want manual close)
  useEffect(() => {
    if (status === "SEALED" || status === "FINALIZED") {
      // Auto-close after 3 seconds
      const timer = setTimeout(() => {
        closeTransaction();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, closeTransaction]);

  const handleCopy = async () => {
    if (!currentTxId) return;
    try {
      await navigator.clipboard.writeText(currentTxId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  const explorerUrl = currentTxId
    ? getExplorerUrl(currentTxId, DEFAULT_NETWORK)
    : null;

  const statusColor = status
    ? STATUS_COLORS[status as keyof typeof STATUS_COLORS]
    : "text-gray-400";
  const statusLabel = status
    ? STATUS_LABELS[status as keyof typeof STATUS_LABELS]
    : "Submitting...";

  return (
    <Dialog open={open} onOpenChange={(open) => !open && closeTransaction()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transaction Status</DialogTitle>
          <DialogDescription>
            Track your transaction status in real-time
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transaction ID with Copy */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-400">
              Transaction ID
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-md bg-neutral-900 border border-neutral-700 text-xs font-mono text-neutral-100 break-all">
                {currentTxId || "..."}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-400">
              Status
            </label>
            <div className="flex items-center gap-2">
              {status === null && (
                <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
              )}
              <span className={`text-sm font-medium ${statusColor}`}>
                {statusLabel}
              </span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3">
              <p className="text-xs text-red-400">Error: {error.message}</p>
            </div>
          )}

          {/* Explorer Link */}
          {explorerUrl && explorerUrl !== "#" && (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => window.open(explorerUrl, "_blank")}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View on Flowscan
              </Button>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            {(status === "SEALED" || status === "FINALIZED") && (
              <Button onClick={closeTransaction} variant="default">
                Close
              </Button>
            )}
            {status !== "SEALED" &&
              status !== "FINALIZED" &&
              status !== "EXPIRED" && (
                <Button onClick={closeTransaction} variant="outline">
                  Close (keep tracking)
                </Button>
              )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
