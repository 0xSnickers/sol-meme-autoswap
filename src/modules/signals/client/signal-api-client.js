import { APP_CONFIG } from '../../../config/app-config.js';
import { withAppBasePath } from '../../../lib/app-path.js';

export function buildSignalSnapshotUrl(
  limit = APP_CONFIG.signals.snapshotLimit,
  mode = 'persisted'
) {
  const params = new URLSearchParams({
    limit: String(limit),
  });
  if (mode === 'realtime') {
    params.set('mode', 'realtime');
  }
  return withAppBasePath(`/api/signals/snapshot?${params.toString()}`);
}

export function buildSignalStreamUrl(limit = APP_CONFIG.signals.snapshotLimit) {
  return withAppBasePath(`/api/signals/stream?limit=${encodeURIComponent(limit)}`);
}

export async function fetchSignalSnapshot({
  limit = APP_CONFIG.signals.snapshotLimit,
  mode = 'persisted',
} = {}) {
  const response = await fetch(buildSignalSnapshotUrl(limit, mode), {
    cache: 'no-store',
  });
  const json = await response.json();

  if (!response.ok) {
    throw new Error(json?.error || '读取信号快照失败');
  }

  return json;
}
