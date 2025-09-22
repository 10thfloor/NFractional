export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl p-4 space-y-4 bg-neutral-950 text-neutral-200">
      <div className="flex items-center justify-between">
        <div className="h-5 w-28 rounded bg-neutral-800 animate-pulse" />
        <div className="h-3 w-40 rounded bg-neutral-900 animate-pulse" />
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <li
            key={`vault-skel-${k}`}
            className="rounded-md border border-neutral-800 bg-neutral-900 overflow-hidden"
          >
            <div className="h-44 w-full bg-neutral-800 animate-pulse" />
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="h-10 rounded bg-neutral-800 animate-pulse" />
                <div className="h-10 rounded bg-neutral-800 animate-pulse" />
                <div className="col-span-2 h-10 rounded bg-neutral-800 animate-pulse" />
              </div>
              <div className="flex gap-2">
                <div className="h-5 w-20 rounded bg-neutral-800 animate-pulse" />
                <div className="h-5 w-28 rounded bg-neutral-800 animate-pulse" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
