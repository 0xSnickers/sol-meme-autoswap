import { APP_CONFIG } from '../../../config/app-config.js';

export function buildSignalSnapshotUrl(limit = APP_CONFIG.signals.snapshotLimit) {
  return `/api/signals/snapshot?limit=${encodeURIComponent(limit)}`;
}

export function buildSignalStreamUrl(limit = APP_CONFIG.signals.snapshotLimit) {
  return `/api/signals/stream?limit=${encodeURIComponent(limit)}`;
}

export async function fetchSignalSnapshot({ limit = APP_CONFIG.signals.snapshotLimit } = {}) {
  const response = await fetch(buildSignalSnapshotUrl(limit), {
    cache: 'no-store',
  });
  const json = await response.json();

  if (!response.ok) {
    throw new Error(json?.error || '读取信号快照失败');
  }

  return json;
}
