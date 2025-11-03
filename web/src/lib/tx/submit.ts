"use client";

import { waitForTransactionExecuted, waitForTransactionSealed } from "@/lib/tx/utils";
import type { FclClient } from "@/lib/types/fcl";

type WaitMode = "sealed" | "executed";

export async function submitTx(
  fcl: FclClient,
  cfg: Record<string, unknown>,
  show: (txId: string) => void,
  opts: { wait?: WaitMode; timeoutMs?: number } = {}
): Promise<string> {
  const { wait = "sealed", timeoutMs = 60_000 } = opts;
  const txId = (await (fcl as unknown as { mutate: (c: Record<string, unknown>) => Promise<string> }).mutate(
    cfg
  )) as string;
  show(txId);
  if (wait === "executed") {
    await waitForTransactionExecuted(fcl as unknown as unknown, txId, timeoutMs);
  } else {
    await waitForTransactionSealed(fcl as unknown as unknown, txId, timeoutMs);
  }
  return txId;
}


