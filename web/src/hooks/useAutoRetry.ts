import { useState, useEffect, useRef, useCallback } from "react";

const MAX_AUTO_RETRIES = 3;
const BASE_DELAY_MS = 3_000;

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
  const retryCountRef = useRef(0);
  const autoRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Expose count for UI — driven by the ref to avoid lint issues with
  // setState-in-effect while still giving components a reactive value.
  const [retryCount, setRetryCount] = useState(0);

  // Auto-retry with exponential backoff when in error state.
  // Also resets the counter when the error clears (successful fetch).
  useEffect(() => {
    if (!error || loading) {
      if (autoRetryRef.current) {
        clearTimeout(autoRetryRef.current);
        autoRetryRef.current = null;
      }
      // Reset on success so the next error episode gets a fresh budget
      if (!error && !loading && retryCountRef.current > 0) {
        retryCountRef.current = 0;
        setRetryCount(0); // eslint-disable-line react-hooks/set-state-in-effect -- reset only on error→success transition
      }
      return;
    }
    if (retryCountRef.current >= MAX_AUTO_RETRIES) return;
    const delay = BASE_DELAY_MS * Math.pow(2, retryCountRef.current);
    autoRetryRef.current = setTimeout(() => {
      retryCountRef.current += 1;
      setRetryCount(retryCountRef.current);
      refetch();
    }, delay);
    return () => {
      if (autoRetryRef.current) clearTimeout(autoRetryRef.current);
    };
  }, [error, loading, refetch]); // retryCount intentionally excluded — driven by ref

  // Manual retry resets auto-retry counter so it gets a fresh budget
  const manualRetry = useCallback(() => {
    retryCountRef.current = 0;
    setRetryCount(0);
    refetch();
  }, [refetch]);

  return { retryCount, manualRetry };
}
