export function createScannerRuntimeMetaService({
  entryStageAllocations,
  getPositionEntryStageBase,
  getRadarMeta,
  setRadarMeta,
}) {
  function ensureStrategySessionMeta(db, { reset = false } = {}) {
    const existingStartedAtTs = getRadarMeta(db, 'strategy_started_at_ts', null);
    if (existingStartedAtTs && !reset) {
      return;
    }

    const nowTs = Math.floor(Date.now() / 1000);
    setRadarMeta(db, 'strategy_started_at_ts', nowTs);
    setRadarMeta(db, 'strategy_started_at', new Date(nowTs * 1000).toISOString());
  }

  function formatRuntimeSeconds(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }

  function getStrategyRuntimeInfo(db) {
    const startedAt = getRadarMeta(db, 'strategy_started_at', null);
    const startedAtTsRaw = getRadarMeta(db, 'strategy_started_at_ts', null);
    const startedAtTs = startedAtTsRaw ? Number(startedAtTsRaw) : 0;
    const strategyRuntimeSeconds =
      startedAtTs > 0 ? Math.max(0, Math.floor(Date.now() / 1000) - startedAtTs) : 0;

    return {
      strategyStartedAt: startedAt,
      strategyRuntimeSeconds,
      strategyRuntimeLabel: formatRuntimeSeconds(strategyRuntimeSeconds),
    };
  }

  function getStrategyRuntimeInfoFromStartedAt(startedAt) {
    const startedAtTs = startedAt ? Math.floor(Date.parse(startedAt) / 1000) : 0;
    const strategyRuntimeSeconds =
      startedAtTs > 0 ? Math.max(0, Math.floor(Date.now() / 1000) - startedAtTs) : 0;

    return {
      strategyStartedAt: startedAt,
      strategyRuntimeSeconds,
      strategyRuntimeLabel: formatRuntimeSeconds(strategyRuntimeSeconds),
    };
  }

  function getPositionEntryStage(position) {
    return getPositionEntryStageBase(position, entryStageAllocations);
  }

  return {
    ensureStrategySessionMeta,
    formatRuntimeSeconds,
    getPositionEntryStage,
    getStrategyRuntimeInfo,
    getStrategyRuntimeInfoFromStartedAt,
  };
}
