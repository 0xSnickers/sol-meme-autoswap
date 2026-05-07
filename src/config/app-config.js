export const APP_CONFIG = {
  signals: {
    snapshotLimit: 200,
    minSnapshotLimit: 10,
    maxSnapshotLimit: 120,
    pollSeconds: 30,
    streamIntervalMs: 5_000,
    heartbeatIntervalMs: 15_000,
  },
  ui: {
    alertRowHeight: 214,
    alertListHeight: 600,
    signalRowHeight: 278,
    signalListHeight: 680,
  },
};

export function normalizeSignalLimit(value, fallback = 60) {
  const rowLimit = Number(value || fallback);
  const { minSnapshotLimit, maxSnapshotLimit } = APP_CONFIG.signals;

  return Number.isFinite(rowLimit)
    ? Math.min(Math.max(rowLimit, minSnapshotLimit), maxSnapshotLimit)
    : fallback;
}
