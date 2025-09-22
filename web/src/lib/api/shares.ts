export async function mintSharesToTreasury(
  vaultId: string,
  amount: string
): Promise<{ txId: string }> {
  const res = await fetch("/api/admin/mint-shares-to-treasury", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ vaultId, amount }),
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(error.error || `HTTP error ${res.status}`);
  }

  const data = await res.json();
  return { txId: data.txId };
}

export async function mintShares(
  vaultId: string,
  amount: string,
  recipient: string
): Promise<{ txId: string }> {
  const res = await fetch("/api/admin/mint-shares", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ vaultId, amount, recipient }),
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(error.error || `HTTP error ${res.status}`);
  }

  const data = await res.json();
  return { txId: data.txId };
}

