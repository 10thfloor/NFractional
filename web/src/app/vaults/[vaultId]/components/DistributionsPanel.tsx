"use client";

import { useState } from "react";
import ScheduleForm from "./distributions/ScheduleForm";
import DistributionList from "./distributions/DistributionList";

export default function DistributionsPanel({
  vaultId,
  vaultSymbol,
  creator,
}: {
  vaultId: string;
  vaultSymbol: string;
  creator: string;
}) {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleScheduleSuccess = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <section className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-4 space-y-4">
          <div className="text-sm font-semibold text-neutral-100">
            Schedule Distribution
          </div>
          <ScheduleForm
            vaultId={vaultId}
            vaultSymbol={vaultSymbol}
            creator={creator}
            onSuccess={handleScheduleSuccess}
          />
        </div>

        <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-4 space-y-4">
          <div className="text-sm font-semibold text-neutral-100">
            Scheduled Distributions
          </div>
          <DistributionList
            key={refreshKey}
            vaultId={vaultId}
            vaultSymbol={vaultSymbol}
          />
        </div>
      </div>
    </section>
  );
}

