"use client";

import { usePoolInfo } from "@/hooks/usePoolInfo";
import { useFlowAddresses } from "@/app/FlowAddressesContext";
import { useFlowClient } from "@onflow/react-sdk";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getPoolEvents, type PoolEvent } from "@/lib/api/pools";

export default function PoolDetail({
  params,
}: {
  params: { owner: string; poolId: string };
}) {
  const addrs = useFlowAddresses();
  const fcl = useFlowClient();
  const routeParams = useParams() as { owner?: string; poolId?: string };
  const owner = routeParams?.owner ?? params.owner;
  const poolId = routeParams?.poolId ?? params.poolId;

  const queryFn = useMemo(
    () =>
      ({
        cadence,
        args,
      }: {
        cadence: string;
        args: (
          arg: (v: unknown, t: unknown) => unknown,
          t: unknown
        ) => unknown[];
      }) =>
        (
          fcl as unknown as {
            query: (input: {
              cadence: string;
              args: (
                arg: (v: unknown, t: unknown) => unknown,
                t: unknown
              ) => unknown[];
            }) => Promise<Record<string, string> | null>;
          }
        ).query({ cadence, args }),
    [fcl]
  );

  const poolAddrs = useMemo(
    () => ({ ft: addrs.ft, flow: addrs.flow, amm: addrs.amm }),
    [addrs.ft, addrs.flow, addrs.amm]
  );

  const { info, loading, error } = usePoolInfo(
    owner,
    poolId,
    poolAddrs,
    queryFn
  );

  const [events, setEvents] = useState<PoolEvent[]>([]);
  const [evErr, setEvErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!info?.vaultId) return;
      try {
        const list = await getPoolEvents(info.vaultId, 50);
        if (!cancelled)
          setEvents(
            list.filter(
              (e) =>
                e.type.startsWith("Pool") ||
                e.type === "LiquidityAdded" ||
                e.type === "LiquidityRemoved" ||
                e.type === "Swap"
            )
          );
      } catch (e) {
        if (!cancelled) setEvErr((e as Error).message);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [info?.vaultId]);

  if (error) {
    return (
      <div className="p-6">
        <div className="text-sm text-red-700">{error}</div>
      </div>
    );
  }

  if (loading || !info) {
    return (
      <div className="p-6">
        <div className="text-sm text-gray-600">Loading pool…</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="text-xl font-semibold">Pool {info.poolId}</div>
      <div className="text-sm text-gray-700">Vault: {info.vaultId}</div>
      <div className="text-sm text-gray-700">Symbol: {info.symbol}</div>
      <div className="text-sm text-gray-700">Fee: {info.feeBps} bps</div>
      <div className="text-sm text-gray-700">Reserves</div>
      <div className="text-sm">Share: {info.reserves.share}</div>
      <div className="text-sm">FLOW: {info.reserves.flow}</div>
      <div className="pt-4">
        <div className="text-sm font-semibold mb-2">Recent events</div>
        {evErr ? (
          <div className="text-xs text-red-600">{evErr}</div>
        ) : events.length === 0 ? (
          <div className="text-xs text-gray-500">No recent events.</div>
        ) : (
          <div className="text-xs space-y-2">
            {events.map((ev) => (
              <div key={`${ev.txId}-${ev.evIndex}`} className="flex gap-3">
                <span className="font-mono">{ev.type}</span>
                <span className="text-gray-600">bh {ev.blockHeight}</span>
                <span className="text-gray-600">tx {ev.txId.slice(0, 8)}…</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
