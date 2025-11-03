"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NumericInput from "@/components/form/NumericInput";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { DEFAULT_NETWORK, gqlFetch } from "@/lib/graphql";
import { useFeeParams } from "@/hooks/useFeeQuotes";
import PendingSchedule from "./PendingSchedule";
import FeeEventsTable from "./FeeEventsTable";
import { useFlowCurrentUser } from "@onflow/react-sdk";

type FeeEvent = {
  kind: string;
  token: string;
  amount: string;
  vaultShare: string;
  protocolShare: string;
  payer: string;
  txId: string;
  createdAt: string;
};

export default function ListingFeesPanel({
  vaultId,
  creator,
}: {
  vaultId: string;
  creator?: string | null;
}) {
  const { user } = useFlowCurrentUser();
  const isCreator =
    Boolean(user?.addr && creator) &&
    String(user?.addr).toLowerCase() === String(creator).toLowerCase();

  const { data: params } = useFeeParams(vaultId);
  const [current] = useState<{
    feeBps: number;
    vaultSplitBps: number;
    protocolSplitBps: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "propose" | "history"
  >("overview");
  const [pending, setPending] = useState<{
    feeBps: number;
    vaultSplitBps: number;
    protocolSplitBps: number;
    effectiveAt: string;
  } | null>(null);
  const [fees, setFees] = useState<FeeEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mutLoading, setMutLoading] = useState(false);
  const [mutMsg, setMutMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    feeBps: "100",
    vaultSplitBps: "5000",
    protocolSplitBps: "5000",
    effectiveAt: String(Math.floor(Date.now() / 1000) + 25),
  });
  const [formTouched, setFormTouched] = useState(false);

  const feeBpsNum = Number(form.feeBps || 0);
  const splitVaultNum = Number(form.vaultSplitBps || 0);
  const splitProtocolNum = Number(form.protocolSplitBps || 0);
  const effectiveAtNum = Number(form.effectiveAt || 0);
  const splitsSum = splitVaultNum + splitProtocolNum;
  const validFeeBps = feeBpsNum >= 0 && feeBpsNum <= 10000;
  const validSplits =
    splitVaultNum >= 0 && splitProtocolNum >= 0 && splitsSum === 10000;
  const validEffectiveAt =
    Number.isFinite(effectiveAtNum) && effectiveAtNum > 0;
  const formValid = validFeeBps && validSplits && validEffectiveAt;
  const vaultSplitPct = (splitVaultNum / 100).toFixed(2);
  const protocolSplitPct = (splitProtocolNum / 100).toFixed(2);
  function clampNum(n: number, min: number, max: number): number {
    if (Number.isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  }
  function setFeeBpsSafe(v: string) {
    const n = clampNum(Number(v.replace(/\D+/g, "")), 0, 10000);
    setFormTouched(true);
    setForm((s) => ({ ...s, feeBps: String(n) }));
  }
  function setVaultSplitAuto(v: string) {
    const n = clampNum(Number(v.replace(/\D+/g, "")), 0, 10000);
    const other = clampNum(10000 - n, 0, 10000);
    setFormTouched(true);
    setForm((s) => ({
      ...s,
      vaultSplitBps: String(n),
      protocolSplitBps: String(other),
    }));
  }
  function setProtocolSplitAuto(v: string) {
    const n = clampNum(Number(v.replace(/\D+/g, "")), 0, 10000);
    const other = clampNum(10000 - n, 0, 10000);
    setFormTouched(true);
    setForm((s) => ({
      ...s,
      protocolSplitBps: String(n),
      vaultSplitBps: String(other),
    }));
  }
  function setEffectiveAtNowPlus(seconds: number) {
    setFormTouched(true);
    setForm((s) => ({
      ...s,
      effectiveAt: String(Math.floor(Date.now() / 1000) + seconds),
    }));
  }

  // Initialize propose form from current schedule once it loads, unless user has edited
  useEffect(() => {
    if (!formTouched && current) {
      setForm((s) => ({
        feeBps: String(current.feeBps),
        vaultSplitBps: String(current.vaultSplitBps),
        protocolSplitBps: String(current.protocolSplitBps),
        effectiveAt: s.effectiveAt,
      }));
    }
  }, [current, formTouched]);

  // Derived preview values (no misleading fallbacks)
  const hasActiveFee =
    typeof current?.feeBps === "number" || typeof params?.feeBps === "number";
  const currentFeeBps =
    typeof current?.feeBps === "number"
      ? current.feeBps
      : typeof params?.feeBps === "number"
      ? params.feeBps
      : 0; // no active listing fee
  const currentFeePct = (currentFeeBps / 100).toFixed(2);
  const proposedFeePct = (feeBpsNum / 100).toFixed(2);
  const proposedVaultPct = (splitVaultNum / 100).toFixed(2);
  const proposedProtocolPct = (splitProtocolNum / 100).toFixed(2);

  // Impact analysis based on per-1.0 price unit revenue (bps-based)
  const currentVaultSplitBps: number | null =
    typeof current?.vaultSplitBps === "number"
      ? current.vaultSplitBps
      : typeof params?.vaultSplitBps === "number"
      ? params.vaultSplitBps
      : null;
  const currentProtocolSplitBps: number | null =
    typeof current?.protocolSplitBps === "number"
      ? current.protocolSplitBps
      : typeof params?.protocolSplitBps === "number"
      ? params.protocolSplitBps
      : null;

  const currentVaultFeeBps = Math.floor(
    (currentFeeBps * (currentVaultSplitBps ?? 0)) / 10000
  );
  const currentProtocolFeeBps = Math.floor(
    (currentFeeBps * (currentProtocolSplitBps ?? 0)) / 10000
  );
  const proposedVaultFeeBps = Math.floor((feeBpsNum * splitVaultNum) / 10000);
  const proposedProtocolFeeBps = Math.floor(
    (feeBpsNum * splitProtocolNum) / 10000
  );

  const vaultRevenueDeltaPct =
    currentVaultFeeBps > 0
      ? (
          ((proposedVaultFeeBps - currentVaultFeeBps) / currentVaultFeeBps) *
          100
        ).toFixed(1)
      : proposedVaultFeeBps > 0
      ? "new"
      : "0.0";
  const protocolRevenueDeltaPct =
    currentProtocolFeeBps > 0
      ? (
          ((proposedProtocolFeeBps - currentProtocolFeeBps) /
            currentProtocolFeeBps) *
          100
        ).toFixed(1)
      : proposedProtocolFeeBps > 0
      ? "new"
      : "0.0";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const q = `
          query($network:String!, $vaultId:String!, $limit:Int!){
            fees(network:$network, vaultId:$vaultId, limit:$limit){
              kind token amount vaultShare protocolShare payer txId createdAt
            }
          }
        `;
        const resp = await gqlFetch<{ fees: FeeEvent[] }>(q, {
          network: DEFAULT_NETWORK,
          vaultId,
          limit: 25,
        });
        if (!cancelled) setFees(resp.fees || []);
      } catch (e: unknown) {
        if (!cancelled) setError((e as Error)?.message || "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultId]);

  // Pending from chain only
  useEffect(() => {
    if (!vaultId) return;
    let cancelled = false;
    (async () => {
      try {
        const q = `
          query($network:String!, $vaultId:String!){
            pendingFeeParams(network:$network, vaultId:$vaultId){ feeBps vaultSplitBps protocolSplitBps effectiveAt }
          }
        `;
        const resp = await gqlFetch<{
          pendingFeeParams: {
            feeBps: number;
            vaultSplitBps: number;
            protocolSplitBps: number;
            effectiveAt: string;
          } | null;
        }>(q, { network: DEFAULT_NETWORK, vaultId });
        if (!cancelled) setPending(resp.pendingFeeParams ?? null);
      } catch {
        if (!cancelled) setPending(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultId]);

  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-neutral-100">
          Listing Fees
        </div>
        <div className="text-[11px] text-neutral-400">Vault {vaultId}</div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-neutral-800">
        {[
          { id: "overview", label: "Overview" },
          ...(isCreator ? [{ id: "propose", label: "Propose Changes" }] : []),
          // { id: "history", label: "History" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`px-3 py-1.5 text-xs rounded-t transition-colors ${
              activeTab === (t.id as typeof activeTab)
                ? "bg-neutral-800 text-neutral-100 border-t border-l border-r border-neutral-700"
                : "text-neutral-400 hover:text-neutral-300"
            }`}
            onClick={() => setActiveTab(t.id as typeof activeTab)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Column */}
          <div className="space-y-4">
            {/* Current Fee Schedule */}
            <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-3 space-y-3">
              <div className="text-[11px] text-gray-500 font-medium">
                Current Fee Schedule
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="text-[11px] text-gray-500 font-medium">
                    Total Fee
                  </div>
                  <div className="text-xl font-semibold text-neutral-100">
                    {hasActiveFee ? `${currentFeePct}%` : "—"}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {hasActiveFee
                      ? `${currentFeeBps} bps (charged on fill)`
                      : "No active listing fee"}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] text-gray-500 font-medium">
                    Vault Split
                  </div>
                  <div className="text-sm font-medium text-neutral-200">
                    {typeof currentVaultSplitBps === "number"
                      ? (currentVaultSplitBps / 100).toFixed(2)
                      : typeof currentProtocolSplitBps === "number"
                      ? ((10000 - currentProtocolSplitBps) / 100).toFixed(2)
                      : "—"}
                    %
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {typeof currentVaultSplitBps === "number"
                      ? currentVaultSplitBps
                      : typeof currentProtocolSplitBps === "number"
                      ? 10000 - currentProtocolSplitBps
                      : "—"}{" "}
                    bps
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] text-gray-500 font-medium">
                    Protocol Split
                  </div>
                  <div className="text-sm font-medium text-neutral-200">
                    {typeof currentProtocolSplitBps === "number"
                      ? (currentProtocolSplitBps / 100).toFixed(2)
                      : typeof currentVaultSplitBps === "number"
                      ? ((10000 - currentVaultSplitBps) / 100).toFixed(2)
                      : "—"}
                    %
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {typeof currentProtocolSplitBps === "number"
                      ? currentProtocolSplitBps
                      : typeof currentVaultSplitBps === "number"
                      ? 10000 - currentVaultSplitBps
                      : "—"}{" "}
                    bps
                  </div>
                </div>
              </div>
              <div className="rounded-md border border-neutral-800 bg-neutral-950/50 p-2">
                <div className="text-[11px] text-gray-500 mb-1.5 font-medium">
                  Distribution
                </div>
                <div className="w-full h-2 rounded overflow-hidden border border-neutral-800 flex">
                  <div
                    className="bg-emerald-600 h-full"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          Number(((currentVaultSplitBps ?? 0) / 100).toFixed(2))
                        )
                      )}%`,
                    }}
                    title={`Vault ${((currentVaultSplitBps ?? 0) / 100).toFixed(
                      2
                    )}%`}
                  />
                  <div
                    className="bg-amber-500 h-full"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          Number(
                            ((currentProtocolSplitBps ?? 0) / 100).toFixed(2)
                          )
                        )
                      )}%`,
                    }}
                    title={`Protocol ${(
                      (currentProtocolSplitBps ?? 0) / 100
                    ).toFixed(2)}%`}
                  />
                </div>
              </div>
            </div>

            {/* Fee Events Table */}
            <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-3">
              <FeeEventsTable fees={fees} loading={loading} error={error} />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Pending Schedule */}
            <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-3">
              <PendingSchedule
                pending={pending}
                onActivate={
                  pending && isCreator
                    ? async () => {
                        setMutLoading(true);
                        setMutMsg(null);
                        try {
                          const res = await fetch(
                            "/api/admin/schedule-fee-activation",
                            {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({ vaultId }),
                            }
                          );
                          if (!res.ok) {
                            const error = await res
                              .json()
                              .catch(() => ({ error: `HTTP ${res.status}` }));
                            throw new Error(
                              error.error || `HTTP error ${res.status}`
                            );
                          }
                          const resp = await res.json();
                          setMutMsg(`Scheduled: ${resp.txId}`);
                          try {
                            await new Promise((r) => setTimeout(r, 400));
                            const q = `
                    query($network:String!, $vaultId:String!){
                      feeSchedule(network:$network, vaultId:$vaultId){
                        current{ feeBps vaultSplitBps protocolSplitBps }
                        pending{ feeBps vaultSplitBps protocolSplitBps effectiveAt }
                      }
                    }
                  `;
                            const r2 = await gqlFetch<{
                              feeSchedule: { pending: typeof pending };
                            }>(q, {
                              network: DEFAULT_NETWORK,
                              vaultId,
                            });
                            setPending(r2.feeSchedule?.pending ?? null);
                          } catch {}
                        } catch (e: unknown) {
                          setMutMsg(
                            (e as Error)?.message || "error scheduling"
                          );
                        } finally {
                          setMutLoading(false);
                        }
                      }
                    : undefined
                }
                activating={mutLoading}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === "propose" && isCreator && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Left: Form */}
          <div className="grid gap-4">
            <div className="text-sm font-semibold text-neutral-100">
              Propose New Listing Fees
            </div>
            <div className="grid gap-2">
              <label className="text-sm text-gray-400" htmlFor="feeBps">
                Total Fee (bps)
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                <NumericInput
                  id="feeBps"
                  className="w-28 px-2 py-1"
                  placeholder="e.g. 100"
                  value={form.feeBps}
                  onValueChange={(v) => setFeeBpsSafe(v)}
                  decimals={0}
                />
                <div className="flex gap-2 text-xs">
                  {[30, 50, 100].map((bps) => (
                    <button
                      key={bps}
                      type="button"
                      className="px-2 py-1 border rounded text-gray-400 hover:text-white"
                      onClick={() => setFeeBpsSafe(String(bps))}
                    >
                      {bps} bps
                    </button>
                  ))}
                </div>
                <div className="text-xs text-gray-500">1 bps = 0.01%</div>
              </div>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Vault/Protocol Split</span>
                <span className="text-xs text-gray-500">
                  Vault {vaultSplitPct}% • Protocol {protocolSplitPct}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={10000}
                step={50}
                value={splitVaultNum}
                onChange={(e) => setVaultSplitAuto(e.target.value)}
                className="w-full"
                aria-label="Vault split slider"
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <label
                    className="text-xs text-gray-500"
                    htmlFor="vaultSplitBps"
                  >
                    Vault split (bps)
                  </label>
                  <NumericInput
                    id="vaultSplitBps"
                    className="w-full px-2 py-1"
                    value={form.vaultSplitBps}
                    onValueChange={(v) => setVaultSplitAuto(v)}
                    decimals={0}
                  />
                </div>
                <div className="grid gap-1">
                  <label
                    className="text-xs text-gray-500"
                    htmlFor="protocolSplitBps"
                  >
                    Protocol split (bps)
                  </label>
                  <NumericInput
                    id="protocolSplitBps"
                    className="w-full px-2 py-1"
                    value={form.protocolSplitBps}
                    onValueChange={(v) => setProtocolSplitAuto(v)}
                    decimals={0}
                  />
                </div>
              </div>
            </div>

            {/* Valid/invalid split indicator */}
            <div
              className={`text-xs rounded px-2 py-2 border ${
                validSplits
                  ? "text-green-600 border-green-700"
                  : "text-red-600 border-red-700"
              }`}
            >
              {validSplits
                ? "Valid split configuration"
                : "Splits must sum to 10,000"}
            </div>

            <div className="grid gap-2">
              <label className="text-sm text-gray-400" htmlFor="effectiveAt">
                Effective at
              </label>
              <div className="space-y-2">
                <DateTimePicker
                  id="effectiveAt"
                  value={form.effectiveAt}
                  onChange={(value) =>
                    setForm((s) => ({ ...s, effectiveAt: value }))
                  }
                  placeholder="Select effective date and time"
                />
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    className="px-2 py-1 border rounded text-gray-400 hover:text-white"
                    onClick={() => setEffectiveAtNowPlus(60)}
                  >
                    +1 min
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 border rounded text-gray-400 hover:text-white"
                    onClick={() => setEffectiveAtNowPlus(3600)}
                  >
                    +1 hour
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 border rounded text-gray-400 hover:text-white"
                    onClick={() => setEffectiveAtNowPlus(86400)}
                  >
                    +1 day
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap min-w-0">
              <Button
                type="button"
                variant="secondary"
                disabled={mutLoading || !formValid}
                onClick={async () => {
                  setMutLoading(true);
                  setMutMsg(null);
                  try {
                    const res = await fetch("/api/admin/schedule-fee-params", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        vaultId,
                        feeBps: Number(form.feeBps || 0),
                        vaultSplitBps: Number(form.vaultSplitBps || 0),
                        protocolSplitBps: Number(form.protocolSplitBps || 0),
                        effectiveAt: form.effectiveAt,
                      }),
                    });
                    if (!res.ok) {
                      const error = await res
                        .json()
                        .catch(() => ({ error: `HTTP ${res.status}` }));
                      throw new Error(
                        error.error || `HTTP error ${res.status}`
                      );
                    }
                    const resp = await res.json();
                    setMutMsg(`Pending set: ${resp.txId}`);
                    try {
                      const q = `
                    query($network:String!, $vaultId:String!){
                      pendingFeeParams(network:$network, vaultId:$vaultId){ feeBps vaultSplitBps protocolSplitBps effectiveAt }
                    }
                  `;
                      const r = await gqlFetch<{
                        pendingFeeParams: typeof pending;
                      }>(q, {
                        network: DEFAULT_NETWORK,
                        vaultId,
                      });
                      setPending(r.pendingFeeParams ?? null);
                    } catch {}
                  } catch (e: unknown) {
                    setMutMsg(
                      (e as Error)?.message || "error setting pending params"
                    );
                  } finally {
                    setMutLoading(false);
                  }
                }}
              >
                {mutLoading ? "Saving…" : "Propose Fee Schedule"}
              </Button>
              {mutMsg && (
                <span className="text-xs text-gray-600 break-all min-w-0">
                  {mutMsg}
                </span>
              )}
            </div>

            <div className="text-[11px] text-gray-500 space-y-0.5 flex flex-col gap-1 border rounded p-3 mt-1">
              <div>How fee splits work:</div>
              <ul className="list-disc ml-4">
                <li>Total must equal 10,000 (representing 100%).</li>
                <li>1 basis point (bps) = 0.01%.</li>
                <li>Changes take effect at the specified date/time.</li>
                <li>Existing transactions are not affected.</li>
              </ul>
            </div>
          </div>

          {/* Right: Preview */}
          <div className="grid gap-3">
            <div className="text-sm font-semibold text-neutral-100">
              Preview Changes
            </div>
            <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-3 grid gap-3">
              <div className="space-y-1">
                <div className="text-[11px] text-gray-500 font-medium">
                  Total Fee
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">
                    Current: {currentFeePct}%
                  </span>
                  <span className="text-neutral-100 font-medium">
                    → {proposedFeePct}%
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] text-gray-500 font-medium">
                  Proposed Distribution
                </div>
                <div className="w-full h-2 rounded overflow-hidden border border-neutral-800 flex">
                  <div
                    className="bg-emerald-600 h-full"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(100, Number(proposedVaultPct))
                      )}%`,
                    }}
                    title={`Vault ${proposedVaultPct}%`}
                  />
                  <div
                    className="bg-amber-500 h-full"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(100, Number(proposedProtocolPct))
                      )}%`,
                    }}
                    title={`Protocol ${proposedProtocolPct}%`}
                  />
                </div>
              </div>
              <div className="space-y-1 pt-2 border-t border-neutral-700">
                <div className="text-[11px] text-gray-500 font-medium">
                  Impact Analysis
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Vault revenue change:</span>
                    <span className="text-neutral-100 font-medium">
                      {String(vaultRevenueDeltaPct)}%
                      {vaultRevenueDeltaPct === "new" ? " (from 0)" : ""}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">
                      Protocol revenue change:
                    </span>
                    <span className="text-neutral-100 font-medium">
                      {String(protocolRevenueDeltaPct)}%
                      {protocolRevenueDeltaPct === "new" ? " (from 0)" : ""}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div>
          <FeeEventsTable fees={fees} loading={loading} error={error} />
        </div>
      )}
    </div>
  );
}
