"use client";

export type FeeEvent = {
  kind: string;
  token: string;
  amount: string;
  vaultShare: string;
  protocolShare: string;
  payer: string;
  txId: string;
  createdAt: string;
};

export default function FeeEventsTable({
  fees,
  loading,
  error,
}: {
  fees: FeeEvent[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recent Fee Events</h3>
        <div className="text-[11px] text-gray-500">
          {loading ? "Loading…" : error ? error : null}
        </div>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-xs text-gray-500">
          <thead className="text-left">
            <tr>
              <th className="py-0.5 pr-2">When</th>
              <th className="py-0.5 pr-2">Kind</th>
              <th className="py-0.5 pr-2">Token</th>
              <th className="py-0.5 pr-2">Amount</th>
              <th className="py-0.5 pr-2">Vault</th>
              <th className="py-0.5 pr-2">Protocol</th>
              <th className="py-0.5 pr-2">Payer</th>
            </tr>
          </thead>
          <tbody>
            {fees.map((f) => (
              <tr key={`${f.txId}-${f.createdAt}`}>
                <td className="py-0.5 pr-2 whitespace-nowrap">
                  {new Date(f.createdAt).toLocaleString()}
                </td>
                <td className="py-0.5 pr-2">{f.kind}</td>
                <td className="py-0.5 pr-2">{f.token}</td>
                <td className="py-0.5 pr-2">{f.amount}</td>
                <td className="py-0.5 pr-2">{f.vaultShare}</td>
                <td className="py-0.5 pr-2">{f.protocolShare}</td>
                <td
                  className="py-0.5 pr-2 truncate max-w-[140px]"
                  title={f.payer}
                >
                  {f.payer}
                </td>
              </tr>
            ))}
            {fees.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="py-1 text-gray-400 text-xs">
                  No fee events yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
