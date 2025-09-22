"use client";

import { FlowProvider } from "@onflow/react-sdk";
import { useEffect, useState, useMemo } from "react";
import flowJSON from "../flow.json";
import { FlowAddressesProvider } from "./FlowAddressesContext";

export default function FlowRootProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  // Read env vars at runtime, not build time
  const flowConfig = useMemo(
    () => ({
      accessNodeUrl:
        process.env.NEXT_PUBLIC_ACCESS_NODE || "http://localhost:8888",
      flowNetwork: (process.env.NEXT_PUBLIC_FLOW_NETWORK || "emulator") as
        | "emulator"
        | "testnet"
        | "mainnet",
      discoveryWallet:
        process.env.NEXT_PUBLIC_DISCOVERY_WALLET ||
        "http://localhost:8701/fcl/authn",
      appDetailTitle: "Fractalize",
      appDetailIcon: "/aloha.svg",
      appDetailDescription: "Fractalize",
    }),
    []
  );

  useEffect(() => {
    setMounted(true);
    // Log config for debugging
    if (typeof window !== "undefined") {
      console.log("[FlowProvider] Config:", {
        network: flowConfig.flowNetwork,
        accessNode: flowConfig.accessNodeUrl,
        discoveryWallet: flowConfig.discoveryWallet,
      });
    }
  }, [flowConfig]);

  if (!mounted) {
    return null;
  }

  return (
    <FlowProvider
      config={flowConfig}
      flowJson={flowJSON as Record<string, unknown>}
    >
      <FlowAddressesProvider>
        <div suppressHydrationWarning>{children}</div>
      </FlowAddressesProvider>
    </FlowProvider>
  );
}
