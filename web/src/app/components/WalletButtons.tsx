"use client";

import { useFlowCurrentUser } from "@onflow/react-sdk";
import { Button } from "@/components/ui/button";

export default function WalletButtons() {
  const { user, unauthenticate, authenticate } = useFlowCurrentUser();
  if (!user?.loggedIn) {
    return (
      <Button variant="outline" size="sm" type="button" onClick={authenticate}>
        Connect Wallet
      </Button>
    );
  }
  return (
    <Button
      variant="secondary"
      size="sm"
      type="button"
      onClick={unauthenticate}
    >
      Sign Out
    </Button>
  );
}
