"use client";

export default function CustodyStatus({ ready }: { ready: boolean }) {
  return (
    <section className="rounded border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">Custody</div>
        {ready ? (
          <span className="text-green-700 text-sm">Ready</span>
        ) : (
          <span className="text-amber-700 text-sm">Not set up</span>
        )}
      </div>
      <p className="text-sm text-gray-700">
        Your NFT remains in your custody resource. The platform records vault
        metadata and emits events; it never takes possession of your NFT.
      </p>
    </section>
  );
}
