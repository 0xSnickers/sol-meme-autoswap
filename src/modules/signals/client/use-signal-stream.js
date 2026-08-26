'use client';

import { useEffect, useRef, useState } from 'react';
import { APP_CONFIG } from '../../../config/app-config.js';
import { buildSignalStreamUrl } from './signal-api-client.js';

export function useSignalStream({
  limit = APP_CONFIG.signals.snapshotLimit,
  enabled = true,
  onSnapshot,
  onInvalidSnapshot,
  onFallbackChange,
} = {}) {
  const [connected, setConnected] = useState(false);
  const [fallbackActive, setFallbackActive] = useState(false);
  const onSnapshotRef = useRef(onSnapshot);
  const onInvalidSnapshotRef = useRef(onInvalidSnapshot);
  const onFallbackChangeRef = useRef(onFallbackChange);
  const lastSnapshotAtRef = useRef(Date.now());

  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
    onInvalidSnapshotRef.current = onInvalidSnapshot;
    onFallbackChangeRef.current = onFallbackChange;
  }, [onFallbackChange, onInvalidSnapshot, onSnapshot]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let disposed = false;
    lastSnapshotAtRef.current = Date.now();
    setConnected(false);
    const source = new EventSource(buildSignalStreamUrl(limit));

    source.onopen = () => {
      if (!disposed) {
        setConnected(true);
      }
    };

    source.addEventListener('snapshot', (event) => {
      if (disposed) {
        return;
      }

      try {
        const json = JSON.parse(event.data);
        lastSnapshotAtRef.current = Date.now();
        onSnapshotRef.current?.(json);
        setConnected(true);
        setFallbackActive(false);
        onFallbackChangeRef.current?.(false);
      } catch (error) {
        setConnected(false);
        onInvalidSnapshotRef.current?.(error);
      }
    });

    source.addEventListener('stream-error', () => {
      if (!disposed) {
        setConnected(false);
      }
    });

    source.addEventListener('refresh-cycle', () => {
      if (disposed) {
        return;
      }
      lastSnapshotAtRef.current = Date.now();
      setConnected(true);
      setFallbackActive(false);
      onFallbackChangeRef.current?.(false);
    });

    source.onerror = () => {
      if (!disposed) {
        setConnected(false);
      }
    };

    const watchdogTimer = window.setInterval(() => {
      if (disposed) {
        return;
      }
      const shouldFallback =
        Date.now() - lastSnapshotAtRef.current >= APP_CONFIG.signals.streamFallbackMs;
      setFallbackActive(shouldFallback);
      onFallbackChangeRef.current?.(shouldFallback);
    }, 5_000);

    return () => {
      disposed = true;
      window.clearInterval(watchdogTimer);
      source.close();
    };
  }, [enabled, limit]);

  return { connected, fallbackActive };
}
