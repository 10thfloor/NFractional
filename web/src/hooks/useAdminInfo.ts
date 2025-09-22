"use client";

import { useEffect, useMemo, useState } from "react";
import { makeAdminAuth, type FlowAuthorizationFn } from "@/lib/flow";
import { fetchAdminInfo } from "@/lib/api/listings";

export function useAdminInfo(): {
  adminInfo: { addr: string; keyId: number } | null;
  adminAuth: FlowAuthorizationFn | null;
  adminReady: boolean;
} {
  const [adminInfo, setAdminInfo] = useState<{
    addr: string;
    keyId: number;
  } | null>(null);

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
    return adminInfo ? makeAdminAuth(adminInfo) : null;
  }, [adminInfo]);

  return {
    adminInfo,
    adminAuth,
    adminReady: Boolean(adminAuth && adminInfo?.addr),
  };
}
