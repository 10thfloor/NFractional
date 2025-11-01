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
 * Gets the current Flow network
 */
function getNetwork(): string {
  return process.env.NEXT_PUBLIC_FLOW_NETWORK || "emulator";
}

/**
 * Checks if we're running on emulator (which doesn't support WebSocket subscriptions)
 */
function isEmulator(): boolean {
  return getNetwork() === "emulator";
}

/**
 * Gets the WebSocket URL based on the Flow network
 */
function getWebSocketUrl(): string {
  const network = getNetwork();

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
 * Gets the REST API URL for transaction status
 */
function getRestApiUrl(): string {
  const network = getNetwork();
  const accessNodeUrl =
    process.env.NEXT_PUBLIC_ACCESS_NODE || "http://localhost:8888";

  // For emulator, use the configured access node URL
  if (network === "emulator") {
    return accessNodeUrl;
  }

  // For other networks, use standard REST endpoints
  switch (network) {
    case "mainnet":
      return "https://rest-mainnet.onflow.org";
    case "testnet":
      return "https://rest-testnet.onflow.org";
    default:
      return "https://rest-testnet.onflow.org";
  }
}

/**
 * Polls transaction status using REST API (fallback for emulator)
 */
function pollTransactionStatus(
  fcl: FlowClient,
  txId: string,
  callbacks: {
    onData?: (status: TransactionStatus) => void;
    onError?: (error: Error) => void;
  },
  intervalMs = 1000,
  timeoutMs = 60000
): () => void {
  let cancelled = false;
  let timeoutId: NodeJS.Timeout | null = null;
  const startTime = Date.now();
  const restApiUrl = getRestApiUrl();

  const poll = async () => {
    if (cancelled) return;

    try {
      // Try transaction_results endpoint first (more reliable for status)
      let response = await fetch(
        `${restApiUrl}/v1/transaction_results/${txId}`
      );

      // If that fails, try transactions endpoint
      if (response.status === 404) {
        response = await fetch(`${restApiUrl}/v1/transactions/${txId}`);
      }

      if (cancelled) return;

      // 404 means transaction not found yet (not indexed), treat as PENDING
      if (response.status === 404) {
        callbacks.onData?.("PENDING");
        if (Date.now() - startTime < timeoutMs) {
          timeoutId = setTimeout(poll, intervalMs);
        } else {
          callbacks.onError?.(new Error("Transaction status polling timeout"));
        }
        return;
      }

      if (!response.ok) {
        throw new Error(
          `Failed to fetch transaction status: ${response.status}`
        );
      }

      const data = (await response.json()) as {
        status?: string;
        transaction?: { status?: string };
        transaction_result?: { status?: string };
        result?: { status?: string };
        [key: string]: unknown; // Allow any other properties
      };

      // Flow REST API returns status in different places depending on the endpoint
      // Try multiple possible locations - check actual response structure
      let statusStr: string | undefined =
        data.status ||
        data.transaction?.status ||
        data.transaction_result?.status ||
        data.result?.status;

      // If we still don't have a status, log the response for debugging
      if (!statusStr) {
        console.warn(
          "[pollTransactionStatus] Unexpected response structure for txId:",
          txId,
          "Response:",
          data
        );
        statusStr = "PENDING";
      }

      // Normalize status values (Flow returns "Sealed", "Executed", etc.)
      statusStr = statusStr.toUpperCase();

      // Map Flow status values to our TransactionStatus type
      // Flow uses: PENDING, FINALIZED, EXECUTED, SEALED, EXPIRED
      const status = (
        statusStr === "SEALED" || statusStr === "2"
          ? "SEALED"
          : statusStr === "FINALIZED" || statusStr === "3"
          ? "FINALIZED"
          : statusStr === "EXECUTED" || statusStr === "1"
          ? "EXECUTED"
          : statusStr === "EXPIRED" || statusStr === "4"
          ? "EXPIRED"
          : "PENDING"
      ) as TransactionStatus;

      if (cancelled) return;

      callbacks.onData?.(status);

      // Continue polling if not final
      if (!["SEALED", "FINALIZED", "EXPIRED"].includes(status)) {
        if (Date.now() - startTime < timeoutMs) {
          timeoutId = setTimeout(poll, intervalMs);
        } else {
          callbacks.onError?.(new Error("Transaction status polling timeout"));
        }
      }
    } catch (e) {
      if (!cancelled) {
        // Don't stop polling on network errors - might be temporary
        console.warn("[pollTransactionStatus] Error polling:", e);
        if (Date.now() - startTime < timeoutMs) {
          timeoutId = setTimeout(poll, intervalMs);
        } else {
          callbacks.onError?.(e as Error);
        }
      }
    }
  };

  // Start polling
  poll();

  return () => {
    cancelled = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };
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
  // Subscription ID must be <= 20 chars. Use first 8 chars of txId + 4-char timestamp suffix
  const ts = Date.now().toString().slice(-4); // Last 4 digits of timestamp
  const txPrefix = txId.slice(0, 8); // First 8 chars of txId
  const subscriptionId = `${txPrefix}-${ts}`; // Max 13 chars
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
            tx_id: txId,
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
 * Waits for a transaction to be sealed using websocket subscription (or polling for emulator)
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

    // Use polling for emulator, WebSocket for testnet/mainnet
    const cleanup = isEmulator()
      ? pollTransactionStatus(
          fcl,
          txId,
          {
            onData: (status) => {
              if (
                (status === "SEALED" || status === "FINALIZED") &&
                !resolved
              ) {
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
          },
          1000,
          timeoutMs
        )
      : subscribeToTransactionStatus(txId, {
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
 * React hook to subscribe to transaction status via websocket (or polling for emulator)
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

    // Use polling for emulator, WebSocket for testnet/mainnet
    if (isEmulator()) {
      cleanupRef.current = pollTransactionStatus(
        fcl,
        txId,
        {
          onData: (newStatus) => {
            setStatus(newStatus);
          },
          onError: (err) => {
            setError(err);
          },
        },
        1000, // Poll every 1 second
        60000 // 60 second timeout
      );
    } else {
      cleanupRef.current = subscribeToTransactionStatus(txId, {
        onData: (newStatus) => {
          setStatus(newStatus);
        },
        onError: (err) => {
          setError(err);
        },
      });
    }

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [txId, fcl]);

  return { status, error };
}
