'use client';

import { useCallback, useEffect, useState } from 'react';
import { APP_CONFIG } from '../../../config/app-config.js';
import { fetchSignalSnapshot } from './signal-api-client.js';

const INITIAL_HEADER_META = {
  strategyRuntimeLabel: '',
  strategyRuntimeSeconds: 0,
  strategyStartedAt: '',
};

export function useSignalSnapshot({
  limit = APP_CONFIG.signals.snapshotLimit,
  pollSeconds = APP_CONFIG.signals.pollSeconds,
  enabled = true,
  errorMessage = '读取信号快照失败',
  onSnapshot,
} = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(pollSeconds);
  const [headerMeta, setHeaderMeta] = useState(INITIAL_HEADER_META);

  const applySnapshot = useCallback(
    (json) => {
      setData(json);
      setHeaderMeta((current) => ({
        strategyRuntimeLabel: json.strategyRuntimeLabel || current.strategyRuntimeLabel,
        strategyRuntimeSeconds: json.strategyRuntimeSeconds ?? current.strategyRuntimeSeconds,
        strategyStartedAt: json.strategyStartedAt || current.strategyStartedAt,
      }));
      setError('');
      setLoading(false);
      setCountdown(pollSeconds);
      onSnapshot?.(json);
    },
    [onSnapshot, pollSeconds]
  );

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let disposed = false;

    async function load() {
      try {
        setError('');
        const json = await fetchSignalSnapshot({ limit });
        if (!disposed) {
          applySnapshot(json);
        }
      } catch (requestError) {
        if (!disposed) {
          setError(requestError instanceof Error ? requestError.message : errorMessage);
          setLoading(false);
        }
      }
    }

    void load();
    const pollTimer = window.setInterval(() => {
      void load();
    }, pollSeconds * 1000);
    const countdownTimer = window.setInterval(() => {
      setCountdown((value) => (value <= 1 ? pollSeconds : value - 1));
    }, 1000);

    return () => {
      disposed = true;
      window.clearInterval(pollTimer);
      window.clearInterval(countdownTimer);
    };
  }, [applySnapshot, enabled, errorMessage, limit, pollSeconds]);

  return {
    data,
    error,
    loading,
    countdown,
    headerMeta,
    setData,
    setError,
    setLoading,
    setHeaderMeta,
    applySnapshot,
  };
}
