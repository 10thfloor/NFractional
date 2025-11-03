"use client";

import { useFlowClient } from "@onflow/react-sdk";
import { useTransactionStatus } from "@/lib/tx/utils";
import { useTransactionStatusModal } from "@/app/TransactionStatusContext";

export function useGlobalTxPending(): boolean {
  const fcl = useFlowClient();
  const { currentTxId } = useTransactionStatusModal();
  const { status } = useTransactionStatus(fcl, currentTxId);
  if (!currentTxId) return false;
  return status !== "SEALED" && status !== "FINALIZED" && status !== "EXPIRED";
}
