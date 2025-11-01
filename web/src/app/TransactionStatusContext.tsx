"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

type TransactionStatusContextType = {
  showTransaction: (txId: string) => void;
  closeTransaction: () => void;
  currentTxId: string | null;
};

const TransactionStatusContext = createContext<
  TransactionStatusContextType | undefined
>(undefined);

export function TransactionStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentTxId, setCurrentTxId] = useState<string | null>(null);

  const showTransaction = useCallback((txId: string) => {
    setCurrentTxId(txId);
  }, []);

  const closeTransaction = useCallback(() => {
    setCurrentTxId(null);
  }, []);

  return (
    <TransactionStatusContext.Provider
      value={{ showTransaction, closeTransaction, currentTxId }}
    >
      {children}
    </TransactionStatusContext.Provider>
  );
}

export function useTransactionStatusModal() {
  const context = useContext(TransactionStatusContext);
  if (!context) {
    throw new Error(
      "useTransactionStatusModal must be used within TransactionStatusProvider"
    );
  }
  return context;
}

