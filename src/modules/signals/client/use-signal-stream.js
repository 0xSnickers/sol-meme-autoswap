'use client';

import { useEffect, useRef, useState } from 'react';
import { APP_CONFIG } from '../../../config/app-config.js';
import { buildSignalStreamUrl } from './signal-api-client.js';

export function useSignalStream({
  limit = APP_CONFIG.signals.snapshotLimit,
  enabled = true,
  onSnapshot,
  onInvalidSnapshot,
} = {}) {
  const [connected, setConnected] = useState(false);
  const onSnapshotRef = useRef(onSnapshot);
  const onInvalidSnapshotRef = useRef(onInvalidSnapshot);

  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
    onInvalidSnapshotRef.current = onInvalidSnapshot;
  }, [onInvalidSnapshot, onSnapshot]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let disposed = false;
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
        onSnapshotRef.current?.(json);
        setConnected(true);
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

    source.onerror = () => {
      if (!disposed) {
        setConnected(false);
      }
    };

    return () => {
      disposed = true;
      source.close();
    };
  }, [enabled, limit]);

  return { connected };
}
