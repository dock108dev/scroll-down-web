import { useState, useEffect, useRef, useCallback } from "react";

const MAX_AUTO_RETRIES = 3;
const BASE_DELAY_MS = 10_000;

/**
 * Auto-retry with exponential backoff on error.
 * Returns { retryCount, manualRetry } — retryCount resets on success.
 */
export function useAutoRetry({
  error,
  loading,
  refetch,
}: {
  error: unknown;
  loading: boolean;
  refetch: () => void;
}) {
  const [retryCount, setRetryCount] = useState(0);
  const autoRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset retry count when error clears (successful fetch)
  useEffect(() => {
    if (!error && !loading) {
      setRetryCount(0);
    }
  }, [error, loading]);

  // Auto-retry with exponential backoff when in error state
  useEffect(() => {
    if (!error || loading) {
      if (autoRetryRef.current) {
        clearTimeout(autoRetryRef.current);
        autoRetryRef.current = null;
      }
      return;
    }
    if (retryCount >= MAX_AUTO_RETRIES) return;
    const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
    autoRetryRef.current = setTimeout(() => {
      setRetryCount((c) => c + 1);
      refetch();
    }, delay);
    return () => {
      if (autoRetryRef.current) clearTimeout(autoRetryRef.current);
    };
  }, [error, loading, retryCount, refetch]);

  // Manual retry resets auto-retry counter so it gets a fresh budget
  const manualRetry = useCallback(() => {
    setRetryCount(0);
    refetch();
  }, [refetch]);

  return { retryCount, manualRetry };
}
