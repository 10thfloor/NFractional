"use client";

import { useFlowCurrentUser } from "@onflow/react-sdk";
import { Button } from "@/components/ui/button";

interface NotLoggedInProps {
  message?: string;
  actionLabel?: string;
  className?: string;
}

export default function NotLoggedIn({
  message = "Connect your wallet to continue.",
  actionLabel = "Connect Wallet",
  className = "",
}: NotLoggedInProps) {
  const { authenticate } = useFlowCurrentUser();

  return (
    <div
      className={`rounded-md border border-neutral-700 bg-neutral-900/50 p-3 text-sm text-neutral-400 ${className}`}
    >
      <div className="mb-2">{message}</div>
      <Button 
        variant="outline" 
        size="sm" 
        type="button" 
        onClick={() => {
          authenticate();
        }}
      >
        {actionLabel}
      </Button>
    </div>
  );
}

