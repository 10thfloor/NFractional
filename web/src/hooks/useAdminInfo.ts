"use client";

import { useEffect, useMemo, useState } from "react";
import { makeAdminAuth, type FlowAuthorizationFn } from "@/lib/flow";
import { fetchAdminInfo } from "@/lib/api/listings";
import { useFlowClient } from "@onflow/react-sdk";

export function useAdminInfo(): {
  adminInfo: { addr: string; keyId: number } | null;
  adminAuth: FlowAuthorizationFn | null;
  adminReady: boolean;
} {
  const [adminInfo, setAdminInfo] = useState<{
    addr: string;
    keyId: number;
  } | null>(null);

  const fcl = useFlowClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const info = await fetchAdminInfo();
      if (!cancelled) setAdminInfo(info);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const adminAuth: FlowAuthorizationFn | null = useMemo(() => {
    return adminInfo ? makeAdminAuth({ ...adminInfo, fcl }) : null;
  }, [adminInfo, fcl]);

  return {
    adminInfo,
    adminAuth,
    adminReady: Boolean(adminAuth && adminInfo?.addr),
  };
}
