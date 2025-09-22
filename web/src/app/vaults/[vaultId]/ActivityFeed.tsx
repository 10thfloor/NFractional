"use client";

import { gqlFetch, DEFAULT_NETWORK } from "@/lib/graphql";
import { useEffect, useState } from "react";

type Event = {
  network: string;
  vaultId: string;
  blockHeight: string;
  txIndex: number;
  evIndex: number;
  txId: string;
  type: string;
  payload?: string | null;
  ts?: string | null;
};

export default function ActivityFeed({ vaultId }: { vaultId: string }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const query = `
          query Ev($network: String!, $vaultId: String!, $limit: Int!) {
            events(network: $network, vaultId: $vaultId, limit: $limit) {
              network vaultId blockHeight txIndex evIndex txId type payload ts
            }
          }
        `;
        const data = await gqlFetch<{ events: Event[] }>(query, {
          network: DEFAULT_NETWORK,
          vaultId,
          limit: 50,
        });
        setEvents(data.events || []);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [vaultId]);

  return (
    <section className="space-y-4">
      <h3
        id="activity-feed"
        className="text-sm font-semibold text-neutral-200 uppercase tracking-wider"
      >
        Activity Feed
      </h3>
      {error && (
        <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-4 text-sm text-red-200">
          {error}
        </div>
      )}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 divide-y divide-neutral-800/50">
        {loading && (
          <div className="p-4 text-sm text-neutral-400">Loading...</div>
        )}
        {!loading && events.length === 0 && (
          <div className="p-4 text-sm text-neutral-400">No recent events.</div>
        )}
        {events.map((e) => (
          <div key={`${e.txId}-${e.evIndex}`} className="p-4 text-sm">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="font-medium text-neutral-200">{e.type}</div>
              <div className="text-xs text-neutral-500 font-mono">
                bh {e.blockHeight} · tx {e.txIndex} · ev {e.evIndex}
              </div>
            </div>
            {e.payload && (
              <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-neutral-400 bg-neutral-900/50 p-2 rounded border border-neutral-800">
                {typeof e.payload === "string"
                  ? e.payload
                  : JSON.stringify(e.payload)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
