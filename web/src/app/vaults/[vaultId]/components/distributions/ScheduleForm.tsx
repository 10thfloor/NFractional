"use client";

import { useFlowCurrentUser } from "@onflow/react-sdk";
import { useMemo, useState, useEffect } from "react";
import { useAdminInfo } from "@/hooks/useAdminInfo";
import Messages from "../Messages";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import NotLoggedIn from "@/components/ui/NotLoggedIn";
import { getVaultTreasuryShareBalance } from "@/lib/api/home";

type ScheduleFormState = {
  programId: string;
  asset: string;
  totalAmount: string;
  schedule: string;
  startsAt: string; // Unix timestamp in seconds (as string)
  endsAt: string; // Unix timestamp in seconds (as string)
};

export default function ScheduleForm({
  vaultId,
  vaultSymbol,
  creator,
  onSuccess,
  refreshKey,
}: {
  vaultId: string;
  vaultSymbol: string;
  creator: string;
  onSuccess?: () => void;
  refreshKey?: number;
}) {
  const { user } = useFlowCurrentUser();
  const { adminReady } = useAdminInfo();
  const isCreator = useMemo(() => {
    if (!user?.addr || !creator) return false;
    return user.addr.toLowerCase() === creator.toLowerCase();
  }, [user?.addr, creator]);

  const [form, setForm] = useState<ScheduleFormState>({
    programId: `dist-${Date.now()}`,
    asset: vaultSymbol,
    totalAmount: "",
    schedule: "one-time",
    startsAt: "",
    endsAt: "",
  });

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Fetch vault treasury share balance
  const [treasuryBalance, setTreasuryBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setBalanceLoading(true);
        const balance = await getVaultTreasuryShareBalance(vaultId);
        if (!cancelled) {
          setTreasuryBalance(balance || "0");
        }
      } catch (e) {
        if (!cancelled) {
          console.error("Failed to fetch treasury balance", e);
          setTreasuryBalance(null);
        }
      } finally {
        if (!cancelled) {
          setBalanceLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultId, refreshKey]);

  const canSubmit = useMemo(() => {
    if (
      !adminReady ||
      !isCreator ||
      !form.programId ||
      !form.totalAmount ||
      Number(form.totalAmount) <= 0 ||
      !form.startsAt ||
      !form.endsAt ||
      balanceLoading ||
      !treasuryBalance ||
      Number(treasuryBalance) <= 0
    ) {
      return false;
    }

    // Validate that startsAt < endsAt (Unix timestamps)
    const startsAtNum = parseInt(form.startsAt, 10);
    const endsAtNum = parseInt(form.endsAt, 10);
    if (isNaN(startsAtNum) || isNaN(endsAtNum)) {
      return false;
    }

    return startsAtNum < endsAtNum;
  }, [
    adminReady,
    isCreator,
    form.programId,
    form.totalAmount,
    form.startsAt,
    form.endsAt,
    balanceLoading,
    treasuryBalance,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || pending) return;

    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      // DateTimePicker already outputs Unix timestamps (seconds since epoch) as strings
      // Call admin API proxy route
      const res = await fetch("/api/admin/schedule-distribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vaultId,
          programId: form.programId,
          asset: form.asset,
          totalAmount: form.totalAmount,
          schedule: form.schedule,
          startsAt: form.startsAt,
          endsAt: form.endsAt,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setSuccess(`Distribution scheduled! Transaction: ${data.txId}`);
      setForm({
        programId: `dist-${Date.now()}`,
        asset: vaultSymbol,
        totalAmount: "",
        schedule: "one-time",
        startsAt: "",
        endsAt: "",
      });
      // Refresh treasury balance after scheduling
      const balance = await getVaultTreasuryShareBalance(vaultId);
      setTreasuryBalance(balance || "0");
      onSuccess?.();
    } catch (e) {
      setError((e as Error).message);
      console.error("Schedule distribution error", e);
    } finally {
      setPending(false);
    }
  };

  if (user && !user.loggedIn) {
    return (
      <NotLoggedIn message="Connect your wallet to schedule distributions." />
    );
  }

  if (!isCreator) {
    return (
      <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-3 text-sm text-neutral-400">
        Only the vault creator can schedule distributions.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Messages error={error} success={success} />
      
      {/* Balance Display */}
      {treasuryBalance !== null && (
        <div className="rounded-md border border-neutral-700 bg-neutral-800/50 p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-neutral-400">Vault Treasury Balance</div>
            <button
              type="button"
              onClick={async () => {
                try {
                  setBalanceLoading(true);
                  const balance = await getVaultTreasuryShareBalance(vaultId);
                  setTreasuryBalance(balance || "0");
                } catch (e) {
                  console.error("Failed to refresh balance", e);
                } finally {
                  setBalanceLoading(false);
                }
              }}
              disabled={balanceLoading}
              className="text-xs text-blue-400 hover:text-blue-300 disabled:text-neutral-600"
            >
              {balanceLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <div className="text-sm font-semibold text-neutral-100">
            {balanceLoading ? (
              <span className="text-neutral-500">Loading...</span>
            ) : (
              <span>
                {Number(treasuryBalance || "0").toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6,
                })}{" "}
                {vaultSymbol}
              </span>
            )}
          </div>
          {!balanceLoading && treasuryBalance && Number(treasuryBalance) <= 0 && (
            <div className="mt-2 text-xs text-yellow-400">
              No balance available. Cannot schedule distributions.
            </div>
          )}
        </div>
      )}
      
      <div className={`space-y-4 ${!balanceLoading && treasuryBalance && Number(treasuryBalance) <= 0 ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="space-y-1">
          <label className="block text-[11px] text-gray-500 font-medium">
            Program ID
          </label>
          <input
            type="text"
            value={form.programId}
            onChange={(e) =>
              setForm((f) => ({ ...f, programId: e.target.value }))
            }
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-600"
            placeholder="dist-123"
            required
          />
          <p className="mt-1 text-[11px] text-gray-500">
            Unique identifier for this distribution program
          </p>
        </div>

        <div className="space-y-1">
          <label className="block text-[11px] text-gray-500 font-medium">
            Asset (Share Symbol)
          </label>
          <input
            type="text"
            value={form.asset}
            onChange={(e) =>
              setForm((f) => ({ ...f, asset: e.target.value }))
            }
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-600"
            placeholder={vaultSymbol}
            required
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[11px] text-gray-500 font-medium">
            Total Amount
          </label>
          <input
            type="text"
            value={form.totalAmount}
            onChange={(e) =>
              setForm((f) => ({ ...f, totalAmount: e.target.value }))
            }
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-600"
            placeholder="1000.0"
            required
          />
          <p className="mt-1 text-[11px] text-gray-500">
            Total amount to distribute across all recipients
          </p>
        </div>

        <div className="space-y-1">
          <label className="block text-[11px] text-gray-500 font-medium">
            Schedule
          </label>
          <select
            value={form.schedule}
            onChange={(e) =>
              setForm((f) => ({ ...f, schedule: e.target.value }))
            }
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-600"
          >
            <option value="one-time">One-time</option>
            <option value="recurring">Recurring</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-[11px] text-gray-500 font-medium">
            Starts At
          </label>
          <DateTimePicker
            value={form.startsAt}
            onChange={(value) =>
              setForm((f) => ({ ...f, startsAt: value }))
            }
            placeholder="Select start date and time"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[11px] text-gray-500 font-medium">
            Ends At
          </label>
          <DateTimePicker
            value={form.endsAt}
            onChange={(value) =>
              setForm((f) => ({ ...f, endsAt: value }))
            }
            placeholder="Select end date and time"
          />
        </div>
      </div>

      <Button
        type="submit"
        variant="secondary"
        disabled={!canSubmit || pending}
        className="w-full"
      >
        {pending ? "Scheduling..." : "Schedule Distribution"}
      </Button>
    </form>
  );
}

