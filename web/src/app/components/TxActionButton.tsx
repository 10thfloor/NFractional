"use client";

import { TransactionButton as FclTransactionButton } from "@onflow/react-sdk";
import type { TransactionButton as TransactionButtonType } from "@onflow/react-sdk";
import { Button } from "@/components/ui/button";
import type React from "react";
import { useCallback, useRef } from "react";

// Props combine shadcn Button props with the FCL TransactionButton props.
// All visual styles are provided by Button; the inner TransactionButton is hidden
// and clicked programmatically to execute the tx.

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

  const handleClick = useCallback(() => {
    if (disabled) return;
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
    }
  }, [disabled]);

  const visibleLabel = children ?? txProps.label ?? "Submit";

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
        disabled={disabled}
        onClick={handleClick}
      >
        {visibleLabel}
      </Button>
      <div
        ref={hiddenRootRef}
        className="absolute -left-[9999px] -top-[9999px] h-0 w-0 overflow-hidden pointer-events-none"
        aria-hidden
      >
        <FclTransactionButton
          {...txProps}
          mutation={resolvedMutation as never}
          onError={(e: unknown) => console.error("Transaction error", e)}
        />
      </div>
    </>
  );
}
