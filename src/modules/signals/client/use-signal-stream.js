'use client';

import { useEffect, useState } from 'react';
import { APP_CONFIG } from '../../../config/app-config.js';
import { buildSignalStreamUrl } from './signal-api-client.js';

export function useSignalStream({
  limit = APP_CONFIG.signals.snapshotLimit,
  enabled = true,
  onSnapshot,
  onInvalidSnapshot,
} = {}) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let disposed = false;
    const source = new EventSource(buildSignalStreamUrl(limit));

    source.addEventListener('snapshot', (event) => {
      if (disposed) {
        return;
      }

      try {
        const json = JSON.parse(event.data);
        onSnapshot?.(json);
        setConnected(true);
      } catch (error) {
        setConnected(false);
        onInvalidSnapshot?.(error);
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
  }, [enabled, limit, onInvalidSnapshot, onSnapshot]);

  return { connected };
}
