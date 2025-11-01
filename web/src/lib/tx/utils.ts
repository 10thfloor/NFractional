"use client";

import { useEffect, useState, useRef } from "react";

/**
 * Flow WebSocket Stream API utilities
 * Reference: https://developers.flow.com/protocol/access-onchain-data/websockets-stream-api
 */

export type TransactionStatus =
  | "PENDING"
  | "SEALED"
  | "EXECUTED"
  | "FINALIZED"
  | "EXPIRED";

type FlowClient = unknown; // Type from @onflow/react-sdk's useFlowClient hook

type WebSocketMessage = {
  subscription_id?: string;
  action?: string;
  topic?: string;
  payload?: {
    id: string;
    status: TransactionStatus;
  };
  error?: {
    code: number;
    message: string;
  };
};

/**
 * Gets the WebSocket URL based on the Flow network
 */
function getWebSocketUrl(): string {
  const network = process.env.NEXT_PUBLIC_FLOW_NETWORK || "emulator";

  switch (network) {
    case "mainnet":
      return "wss://rest-mainnet.onflow.org/v1/ws";
    case "testnet":
      return "wss://rest-testnet.onflow.org/v1/ws";
    case "emulator":
      return "ws://localhost:8888/v1/ws";
    default:
      return "wss://rest-testnet.onflow.org/v1/ws";
  }
}

/**
 * Creates a WebSocket connection and subscribes to transaction status updates
 * Returns a cleanup function to unsubscribe and close the connection
 */
function subscribeToTransactionStatus(
  txId: string,
  callbacks: {
    onData?: (status: TransactionStatus) => void;
    onError?: (error: Error) => void;
  }
): () => void {
  const wsUrl = getWebSocketUrl();
  const ws = new WebSocket(wsUrl);
  const subscriptionId = `tx-${txId.slice(0, 8)}-${Date.now()}`;
  let resolved = false;

  const cleanup = () => {
    if (resolved) return;
    resolved = true;

    try {
      // Unsubscribe before closing
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            subscription_id: subscriptionId,
            action: "unsubscribe",
          })
        );
      }
      ws.close();
    } catch (e) {
      // Ignore cleanup errors
    }
  };

  ws.onopen = () => {
    try {
      // Subscribe to transaction statuses
      ws.send(
        JSON.stringify({
          subscription_id: subscriptionId,
          action: "subscribe",
          topic: "transaction_statuses",
          arguments: {
            transaction_ids: [txId],
          },
        })
      );
    } catch (e) {
      cleanup();
      callbacks.onError?.(new Error(`Failed to subscribe: ${String(e)}`));
    }
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as WebSocketMessage;

      // Handle errors
      if (data.error) {
        cleanup();
        callbacks.onError?.(
          new Error(
            `WebSocket error: ${data.error.code} - ${data.error.message}`
          )
        );
        return;
      }

      // Handle transaction status updates
      if (
        data.subscription_id === subscriptionId &&
        data.topic === "transaction_statuses" &&
        data.payload
      ) {
        const status = data.payload.status;
        callbacks.onData?.(status);
      }
    } catch (e) {
      // Ignore parse errors or unexpected messages
    }
  };

  ws.onerror = (error) => {
    cleanup();
    callbacks.onError?.(
      new Error(`WebSocket connection error: ${String(error)}`)
    );
  };

  ws.onclose = () => {
    // Connection closed - cleanup is handled by cleanup function
  };

  return cleanup;
}

/**
 * Waits for a transaction to be sealed using websocket subscription
 * Replaces the polling-based onceSealed() method
 */
export function waitForTransactionSealed(
  fcl: FlowClient,
  txId: string,
  timeoutMs = 60000
): Promise<void> {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(
          new Error(`Transaction ${txId} status timeout after ${timeoutMs}ms`)
        );
      }
    }, timeoutMs);

    const cleanup = subscribeToTransactionStatus(txId, {
      onData: (status) => {
        // Consider both SEALED and FINALIZED as completion
        if ((status === "SEALED" || status === "FINALIZED") && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          cleanup();
          resolve();
        }
      },
      onError: (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          cleanup();
          reject(err);
        }
      },
    });
  });
}

/**
 * Waits for a transaction to be executed using websocket subscription
 */
export function waitForTransactionExecuted(
  fcl: FlowClient,
  txId: string,
  timeoutMs = 60000
): Promise<void> {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(
          new Error(`Transaction ${txId} status timeout after ${timeoutMs}ms`)
        );
      }
    }, timeoutMs);

    const cleanup = subscribeToTransactionStatus(txId, {
      onData: (status) => {
        if (status === "EXECUTED" || status === "FINALIZED") {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            cleanup();
            resolve();
          }
        }
      },
      onError: (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          cleanup();
          reject(err);
        }
      },
    });
  });
}

/**
 * React hook to subscribe to transaction status via websocket
 */
export function useTransactionStatus(
  fcl: FlowClient,
  txId: string | null
): { status: TransactionStatus | null; error: Error | null } {
  const [status, setStatus] = useState<TransactionStatus | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!txId || !fcl) {
      setStatus(null);
      setError(null);
      return;
    }

    // Clean up previous subscription
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    setStatus(null);
    setError(null);

    const cleanup = subscribeToTransactionStatus(txId, {
      onData: (newStatus) => {
        setStatus(newStatus);
      },
      onError: (err) => {
        setError(err);
      },
    });

    cleanupRef.current = cleanup;

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [txId, fcl]);

  return { status, error };
}
