"use client";

import { useState, useEffect, useCallback } from "react";
import { getVault } from "@/lib/api/vault";

/**
 * Polls for a vault to appear in the database after creation
 * Useful for showing loading state while the indexing pipeline catches up
 */
export function usePollVault(
  vaultId: string | null,
  options: {
    enabled?: boolean;
    interval?: number;
    maxAttempts?: number;
    onFound?: (vault: Awaited<ReturnType<typeof getVault>>) => void;
  } = {}
): {
  vault: Awaited<ReturnType<typeof getVault>> | null;
  isLoading: boolean;
  error: Error | null;
  attempts: number;
} {
  const {
    enabled = true,
    interval = 2000,
    maxAttempts = 30, // 30 attempts * 2s = 60s max wait
    onFound,
  } = options;

  const [vault, setVault] = useState<Awaited<ReturnType<typeof getVault>> | null>(null);
  const [isLoading, setIsLoading] = useState(enabled && !!vaultId);
  const [error, setError] = useState<Error | null>(null);
  const [attempts, setAttempts] = useState(0);

  const poll = useCallback(async (attemptNumber: number): Promise<boolean> => {
    if (!vaultId || !enabled) return false;

    setAttempts(attemptNumber + 1);

    try {
      const result = await getVault(vaultId);

      if (result) {
        setVault(result);
        setIsLoading(false);
        setError(null);
        onFound?.(result);
        return true; // Found
      }

      // Not found yet
      if (attemptNumber >= maxAttempts - 1) {
        setIsLoading(false);
        setError(new Error(`Vault not found after ${maxAttempts} attempts`));
        return false;
      }

      return false; // Continue polling
    } catch (e) {
      if (attemptNumber >= maxAttempts - 1) {
        setIsLoading(false);
        setError(e as Error);
        return false;
      }
      return false; // Continue polling on error
    }
  }, [vaultId, enabled, maxAttempts, onFound]);

  useEffect(() => {
    if (!vaultId || !enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setAttempts(0);
    setVault(null);

    let cancelled = false;
    let intervalId: NodeJS.Timeout | null = null;

    // Initial check
    poll(0).then((found) => {
      if (found || cancelled) return;

      // Poll at interval
      let attempt = 1;
      intervalId = setInterval(async () => {
        if (cancelled) return;
        const found = await poll(attempt);
        attempt++;
        if (found && intervalId) {
          clearInterval(intervalId);
        }
      }, interval);
    });

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [vaultId, enabled, poll, interval]);

  return { vault, isLoading, error, attempts };
}

