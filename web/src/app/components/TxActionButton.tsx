"use client";

import { TransactionButton as FclTransactionButton } from "@onflow/react-sdk";
import type { TransactionButton as TransactionButtonType } from "@onflow/react-sdk";
import { Button } from "@/components/ui/button";
import type React from "react";
import { useCallback, useRef, useState, useEffect } from "react";
import { useFlowClient, useFlowCurrentUser } from "@onflow/react-sdk";
import { useTransactionStatusModal } from "@/app/TransactionStatusContext";

// Props combine shadcn Button props with the FCL TransactionButton props.
// All visual styles are provided by Button; the inner TransactionButton is hidden
// and clicked programmatically to execute the tx.
//
// Transaction Status Handling:
// - TransactionButton from @onflow/react-sdk handles transactions internally
// - All direct mutate() calls in the codebase now use websockets via waitForTransactionSealed()
//   from @/lib/tx/utils instead of polling (onceSealed)
// - TransactionButton's internal status tracking may still use polling internally,
//   but our direct transaction calls use websockets for real-time updates
//
// Account Refresh:
// - Before each transaction, we refresh account info to ensure correct sequence number
// - This prevents sequence number mismatch errors (Error Code 1007)

type ButtonVariant = "default" | "secondary" | "destructive";

type Props = React.ComponentProps<typeof Button> &
  Omit<React.ComponentProps<typeof TransactionButtonType>, "className"> & {
    children?: React.ReactNode;
    // Optional dynamic mutation key to drive react-query caching semantics
    mutationKey?: unknown[] | (() => unknown[]);
  };

export default function TxActionButton({
  variant,
  size,
  className,
  disabled,
  children,
  mutationKey,
  ...txProps
}: Props) {
  const hiddenRootRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fcl = useFlowClient();
  const { user } = useFlowCurrentUser();
  const { showTransaction } = useTransactionStatusModal();

  // Monitor the hidden TransactionButton's status
  useEffect(() => {
    const root = hiddenRootRef.current;
    if (!root) return;

    // Listen for status changes from FCL TransactionButton
    const observer = new MutationObserver(() => {
      // Check for common loading indicators
      const hasLoading = root.querySelector(
        '[data-loading="true"], [aria-busy="true"], .loading'
      );
      const statusEl = root.querySelector(
        '[data-status], .status, [role="status"]'
      );

      if (hasLoading) {
        setIsLoading(true);
        setStatusMessage(null);
      } else {
        setIsLoading(false);
        if (statusEl) {
          const text =
            statusEl.textContent || statusEl.getAttribute("aria-label");
          if (text) setStatusMessage(text);
        }
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "data-loading",
        "aria-busy",
        "data-status",
        "aria-label",
      ],
    });

    return () => observer.disconnect();
  }, []);

  // Also listen to mutation callbacks for status updates
  const mutation = txProps.mutation as
    | {
        onSuccess?: (txId: string) => void | Promise<void>;
        onError?: (error: unknown) => void;
      }
    | undefined;

  const enhancedMutation = mutation
    ? {
        ...mutation,
        onSuccess: async (txId: string) => {
          setIsLoading(true);
          // Show transaction status modal immediately
          showTransaction(txId);
          try {
            await mutation.onSuccess?.(txId);
          } finally {
            setIsLoading(false);
          }
        },
        onError: (error: unknown) => {
          setIsLoading(false);
          setStatusMessage(null);
          mutation.onError?.(error);
        },
      }
    : undefined;

  const handleClick = useCallback(async () => {
    if (disabled || isLoading) return;
    setIsLoading(true);

    // Refresh account info before transaction to ensure correct sequence number
    if (user?.addr && fcl) {
      try {
        const addrNoPrefix = user.addr.replace(/^0x/, "");
        await (
          fcl as { account: (address: string) => Promise<unknown> }
        ).account(addrNoPrefix);
      } catch (e) {
        // If refresh fails, log but continue - FCL will still fetch on transaction build
        console.warn("[TxActionButton] Failed to refresh account info:", e);
      }
    }

    // Try common clickable elements rendered by the inner TransactionButton
    const root = hiddenRootRef.current;
    const el = root?.querySelector("button, [role=button]") as
      | HTMLButtonElement
      | HTMLElement
      | null as HTMLButtonElement | HTMLElement | null;
    if (el && typeof (el as HTMLButtonElement).click === "function") {
      (el as HTMLButtonElement).click();
      return;
    }
    // Fallback: attempt to dispatch a click event on the root container
    if (root) {
      const evt = new MouseEvent("click", { bubbles: true, cancelable: true });
      root.dispatchEvent(evt);
    } else {
      console.warn("TxActionButton: inner TransactionButton not found");
      setIsLoading(false);
    }
  }, [disabled, isLoading, user?.addr, fcl]);

  const visibleLabel = isLoading
    ? statusMessage || children || txProps.label || "Processing..."
    : children ?? txProps.label ?? "Submit";

  // Compute final mutation prop with optional override for mutationKey
  const resolvedMutation = (() => {
    const base = (txProps as unknown as { mutation?: Record<string, unknown> })
      .mutation;
    const key = typeof mutationKey === "function" ? mutationKey() : mutationKey;
    if (key && Array.isArray(key) && key.length > 0) {
      return { ...(base || {}), mutationKey: key } as Record<string, unknown>;
    }
    if (!base || !("mutationKey" in base)) {
      const label = (txProps as unknown as { label?: string }).label || "tx";
      return { ...(base || {}), mutationKey: [label] } as Record<
        string,
        unknown
      >;
    }
    return base as Record<string, unknown> | undefined;
  })();

  return (
    <>
      <Button
        variant={variant as ButtonVariant}
        size={size as never}
        className={className}
        disabled={disabled || isLoading}
        onClick={handleClick}
      >
        {isLoading && (
          <span className="inline-block mr-2 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {visibleLabel}
      </Button>
      {statusMessage && isLoading && (
        <div className="mt-2 text-xs text-neutral-400 animate-pulse">
          {statusMessage}
        </div>
      )}
      <div
        ref={hiddenRootRef}
        className="absolute -left-[9999px] -top-[9999px] h-0 w-0 overflow-hidden pointer-events-none"
        aria-hidden
      >
        <FclTransactionButton
          {...txProps}
          mutation={(enhancedMutation || resolvedMutation) as never}
          onError={(e: unknown) => {
            setIsLoading(false);
            setStatusMessage(null);
            console.error("Transaction error", e);
          }}
        />
      </div>
    </>
  );
}
