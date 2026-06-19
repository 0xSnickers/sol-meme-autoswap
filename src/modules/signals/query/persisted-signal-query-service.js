import {
  buildLegacyTakeProfitStepsFromEnv,
  normalizeTakeProfitSteps,
  parseTakeProfitStepsFromEnv,
} from '../lib/paper-trade-settings.js';
import { ensurePostgresSchemaReady } from '../../../shared/db/client/postgres.js';
import { createRadarRepositories } from '../../../shared/db/repositories/index.js';
import { resolveSignalDbDriver } from '../../../shared/db/client/index.js';

const persistedSnapshotCache = new Map();

function clampLimit(limit, min, max, fallback) {
  return Number.isFinite(limit) ? Math.min(Math.max(Number(limit), min), max) : fallback;
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseJsonValue(value, fallback = null) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function formatRuntimeSeconds(seconds = 0) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

function getRuntimeInfo(startedAt) {
  const startedAtTs = startedAt ? Math.floor(Date.parse(startedAt) / 1000) : 0;
  const strategyRuntimeSeconds =
    startedAtTs > 0 ? Math.max(0, Math.floor(Date.now() / 1000) - startedAtTs) : 0;

  return {
    strategyStartedAt: startedAt || null,
    strategyRuntimeSeconds,
    strategyRuntimeLabel: formatRuntimeSeconds(strategyRuntimeSeconds),
  };
}

function getDefaultPaperTradeSettings() {
  return {
    stopLossPercent: toNumber(process.env.RADAR_PAPER_SL_PERCENT || process.env.SIGNAL_PAPER_SL_PERCENT, 50),
    takeProfitSteps: normalizeTakeProfitSteps(
      parseTakeProfitStepsFromEnv(process.env.RADAR_PAPER_TP_STEPS || process.env.SIGNAL_PAPER_TP_STEPS) ||
        buildLegacyTakeProfitStepsFromEnv()
    ),
    trailingStartPercent: toNumber(
      process.env.RADAR_PAPER_TRAILING_START_PERCENT || process.env.SIGNAL_PAPER_TRAILING_START_PERCENT,
      180
    ),
    trailingStopPercent: toNumber(
      process.env.RADAR_PAPER_TRAILING_STOP_PERCENT || process.env.SIGNAL_PAPER_TRAILING_STOP_PERCENT,
      35
    ),
    timeStopHours: toNumber(
      process.env.RADAR_PAPER_TIME_STOP_HOURS || process.env.SIGNAL_PAPER_TIME_STOP_HOURS,
      8
    ),
  };
}

function getPaperTradeSettings(metaValue, snapshotConfig = {}) {
  return (
    parseJsonValue(metaValue, null) ||
    snapshotConfig.paperTradeSettings ||
    {
      ...getDefaultPaperTradeSettings(),
    }
  );
}

function normalizePositionRow(row) {
  const entryPrice = toNumber(row.entryPrice);
  const currentPrice = toNumber(row.currentPrice);
  const positionSizeUsd = toNumber(row.positionSizeUsd);
  const targetPositionSizeUsd = toNumber(row.targetPositionSizeUsd || row.positionSizeUsd);
  const tokenAmount = toNumber(row.tokenAmount);
  const remainingTokenAmount = toNumber(row.remainingTokenAmount || row.tokenAmount);
  const remainingPositionSizeUsd = toNumber(
    row.remainingPositionSizeUsd || row.positionSizeUsd
  );
  const currentValueUsd = Number((remainingTokenAmount * currentPrice).toFixed(2));
  const realizedPnlUsd = toNumber(row.realizedPnlUsd);
  const pnlUsd = Number((realizedPnlUsd + (currentValueUsd - remainingPositionSizeUsd)).toFixed(2));
  const takeProfitSteps = row.tpPlanJson
    ? normalizeTakeProfitSteps(parseJsonValue(row.tpPlanJson, []))
    : null;

  return {
    id: row.id,
    chain: row.chain,
    address: row.address,
    name: row.name,
    symbol: row.symbol,
    imageUrl: row.imageUrl || '',
    entrySignalCount: toNumber(row.entrySignalCount),
    tradeScore: row.tradeScore ?? null,
    positionSizeUsd,
    targetPositionSizeUsd,
    tokenAmount,
    remainingTokenAmount,
    remainingPositionSizeUsd,
    entryPrice,
    currentPrice,
    peakPrice: toNumber(row.peakPrice || row.currentPrice || row.entryPrice),
    peakPnlPct: toNumber(row.peakPnlPct),
    currentValueUsd,
    pnlPct: toNumber(row.pnlPct),
    pnlUsd,
    takeProfitPct: toNumber(row.takeProfitPct),
    takeProfitSteps,
    stopLossPct: toNumber(row.stopLossPct),
    status: row.status,
    smartMoney: row.smartMoney ?? null,
    buySellRatio: row.buySellRatio ?? null,
    liquidity: row.liquidity ?? null,
    volume: row.volume ?? null,
    realizedPnlUsd,
    realizedProceedsUsd: toNumber(row.realizedProceedsUsd),
    tpStage: toNumber(row.tpStage),
    entryStage: toNumber(row.entryStage, 1),
    openedAt: row.openedAt ? new Date(toNumber(row.openedAt) * 1000).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(toNumber(row.updatedAt) * 1000).toISOString() : null,
    closedAt: row.closedAt ? new Date(toNumber(row.closedAt) * 1000).toISOString() : null,
    closePrice: row.closePrice ?? null,
    closeReason: row.closeReason || '',
    twitter: row.twitter || '',
  };
}

function buildPaperSummary(openPositions, closedPositions) {
  const totalCapitalUsd = toNumber(
    process.env.RADAR_PAPER_TOTAL_CAPITAL_USD || process.env.SIGNAL_PAPER_TOTAL_CAPITAL_USD,
    1000
  );
  const openCostUsd = openPositions.reduce(
    (sum, row) => sum + toNumber(row.remainingPositionSizeUsd || row.positionSizeUsd),
    0
  );
  const openValueUsd = openPositions.reduce((sum, row) => sum + toNumber(row.currentValueUsd), 0);
  const openPnLUsd = openPositions.reduce((sum, row) => sum + toNumber(row.pnlUsd), 0);
  const closedCostUsd = closedPositions.reduce((sum, row) => sum + toNumber(row.positionSizeUsd), 0);
  const closedValueUsd = closedPositions.reduce(
    (sum, row) => sum + toNumber(row.realizedProceedsUsd || row.positionSizeUsd + row.pnlUsd),
    0
  );
  const closedPnLUsd = closedPositions.reduce((sum, row) => sum + toNumber(row.realizedPnlUsd || row.pnlUsd), 0);
  const cashBalanceUsd = totalCapitalUsd - openCostUsd + closedValueUsd;
  const equityUsd = cashBalanceUsd + openValueUsd;
  const totalPnLUsd = openPnLUsd + closedPnLUsd;
  const winCount = closedPositions.filter((row) => toNumber(row.pnlPct) > 0).length;
  const capitalUsagePct = totalCapitalUsd > 0 ? Number(((openCostUsd / totalCapitalUsd) * 100).toFixed(2)) : 0;

  return {
    openCount: openPositions.length,
    closedCount: closedPositions.length,
    winCount,
    winRate: closedPositions.length > 0 ? Number(((winCount / closedPositions.length) * 100).toFixed(1)) : 0,
    openValueUsd: Number(openValueUsd.toFixed(2)),
    openCostUsd: Number(openCostUsd.toFixed(2)),
    openPnLUsd: Number(openPnLUsd.toFixed(2)),
    closedCostUsd: Number(closedCostUsd.toFixed(2)),
    closedValueUsd: Number(closedValueUsd.toFixed(2)),
    closedPnLUsd: Number(closedPnLUsd.toFixed(2)),
    totalCapitalUsd: Number(totalCapitalUsd.toFixed(2)),
    cashBalanceUsd: Number(cashBalanceUsd.toFixed(2)),
    availableUsd: Number(cashBalanceUsd.toFixed(2)),
    usedCapitalUsd: Number(openCostUsd.toFixed(2)),
    equityUsd: Number(equityUsd.toFixed(2)),
    capitalUsagePct,
    totalPnLUsd: Number(totalPnLUsd.toFixed(2)),
  };
}

function buildSignalTimeline(rows, maxPoints = 1500) {
  return [...rows]
    .slice(0, maxPoints)
    .reverse()
    .map((row, index) => ({
      time: new Date(toNumber(row.pushedAt) * 1000).toISOString(),
      signalCount: toNumber(row.signalCount),
      cumulativeCount: index + 1,
      name: row.name,
      symbol: row.symbol,
      address: row.address,
      price: toNumber(row.price),
    }));
}

function buildTradeIntentMaps(rows = []) {
  const latestMap = new Map();
  const signalMap = new Map();

  for (const row of rows) {
    const tokenKey = `${row.chain}:${row.address}`;
    const signalKey = `${tokenKey}:${toNumber(row.signalCount)}`;

    if (!latestMap.has(tokenKey)) {
      latestMap.set(tokenKey, row);
    }
    signalMap.set(signalKey, row);
  }

  return {
    latestMap,
    signalMap,
  };
}

function buildLatestPositionMap(positions = []) {
  const map = new Map();
  for (const row of positions) {
    const key = `${row.chain}:${row.address}`;
    const existing = map.get(key);
    const currentTs = new Date(row.updatedAt || row.openedAt || 0).getTime();
    const existingTs = existing ? new Date(existing.updatedAt || existing.openedAt || 0).getTime() : -1;
    if (!existing || currentTs > existingTs) {
      map.set(key, row);
    }
  }
  return map;
}

function buildGroupedAlerts(
  rows,
  latestTradeIntentMap,
  tradeIntentSignalMap,
  latestPositionMap,
  paperTradeSettings,
  limit
) {
  const groups = new Map();

  for (const row of rows) {
    const key = `${row.chain}:${row.address}`;
    const signalCount = toNumber(row.signalCount);
    const signalKey = `${key}:${signalCount}`;
    const pushedAt = new Date(toNumber(row.pushedAt) * 1000).toISOString();
    const latestPosition = latestPositionMap.get(key);
    const latestTradeIntent = latestTradeIntentMap.get(key);
    const signalTradeIntent = tradeIntentSignalMap.get(signalKey);
    const displayTradeIntent = signalTradeIntent || latestTradeIntent;
    const historyItem = {
      signalCount,
      rounds: toNumber(signalTradeIntent?.rounds, signalCount),
      pushedAt,
      pctGain: toNumber(row.pctGain),
      price: toNumber(row.price),
      tradeScore: signalTradeIntent?.tradeScore ?? row.tradeScore ?? null,
      priceScore: signalTradeIntent?.priceScore ?? null,
    };

    if (!groups.has(key)) {
      if (groups.size >= limit) {
        continue;
      }

      groups.set(key, {
        address: row.address,
        name: row.name,
        symbol: row.symbol,
        chain: row.chain,
        imageUrl: row.imageUrl || latestPosition?.imageUrl || '',
        price: toNumber(row.price),
        mc: toNumber(row.mc),
        liq: toNumber(row.liq),
        volume: toNumber(row.volume),
        smartMoney: toNumber(row.smartMoney),
        holders: toNumber(row.holders),
        buySellRatio: toNumber(row.buySellRatio),
        ageHours: toNumber(row.ageHours),
        change1h: toNumber(row.change1h),
        pctGain: toNumber(row.pctGain),
        stars: toNumber(row.stars, 1),
        narrativeTag: row.narrativeTag || '',
        category: row.category || '',
        signalCount: toNumber(row.signalCount),
        occurrenceCount: 1,
        twitter: row.twitter || latestPosition?.twitter || '',
        telegram: row.telegram || '',
        website: row.website || '',
        message: row.message || '',
        pushedAt,
        firstPushedAt: pushedAt,
        latestPushedAt: pushedAt,
        signalHistory: [historyItem],
        tradeScore: row.tradeScore ?? displayTradeIntent?.tradeScore ?? null,
        priceScore: displayTradeIntent?.priceScore ?? null,
        rounds: toNumber(displayTradeIntent?.rounds, signalCount),
        tradeDecisionStatus: row.tradeStatus || displayTradeIntent?.status || '',
        tradeDecisionReason: row.tradeReason || displayTradeIntent?.decisionReason || '',
        tradeDecisionAt: row.tradeDecisionAt
          ? new Date(toNumber(row.tradeDecisionAt) * 1000).toISOString()
          : displayTradeIntent?.createdAt
            ? new Date(toNumber(displayTradeIntent.createdAt) * 1000).toISOString()
          : null,
        paperPositionStatus: latestPosition?.status || '',
        paperPositionSizeUsd: latestPosition?.positionSizeUsd ?? null,
        paperTargetPositionSizeUsd: latestPosition?.targetPositionSizeUsd ?? latestPosition?.positionSizeUsd ?? null,
        paperTokenAmount: latestPosition?.tokenAmount ?? null,
        paperEntryPrice: latestPosition?.entryPrice ?? null,
        paperCurrentPrice: latestPosition?.currentPrice ?? null,
        paperPnLPct: latestPosition?.pnlPct ?? null,
        paperRealizedPnLUsd: latestPosition?.realizedPnlUsd ?? 0,
        paperOpenedAt: latestPosition?.openedAt || null,
        paperClosedAt: latestPosition?.closedAt || null,
        paperCloseReason: latestPosition?.closeReason || '',
        paperTakeProfitPct: latestPosition?.takeProfitPct ?? paperTradeSettings.takeProfitSteps?.[0]?.targetPercent ?? null,
        paperTakeProfitSteps: latestPosition?.takeProfitSteps || paperTradeSettings.takeProfitSteps || [],
        paperTpStage: latestPosition?.tpStage ?? 0,
        paperStopLossPct: latestPosition?.stopLossPct ?? paperTradeSettings.stopLossPercent ?? null,
        paperEntryStage: latestPosition?.entryStage ?? 1,
      });
      continue;
    }

    const group = groups.get(key);
    group.occurrenceCount += 1;
    group.firstPushedAt = pushedAt;
    group.signalHistory.push(historyItem);
  }

  return [...groups.values()].sort((a, b) => {
    const timeDiff = new Date(b.latestPushedAt || b.pushedAt).getTime() - new Date(a.latestPushedAt || a.pushedAt).getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return (b.smartMoney || 0) - (a.smartMoney || 0);
  });
}

export function canUseDrizzlePersistedSignalQueries(env = process.env) {
  const driver = resolveSignalDbDriver(env);
  return driver === 'sqlite' || driver === 'postgres';
}

export async function readPersistedSignalSnapshotFromDrizzle(limit = 60, options = {}) {
  const env = options.env || process.env;
  const safeLimit = clampLimit(limit, 1, 120, 60);
  const repos = options.repositories || createRadarRepositories(options);
  await ensurePostgresSchemaReady(repos.drizzleClient);
  const driver = repos.drizzleClient?.driver || resolveSignalDbDriver(env);
  const cacheEnabled = options.cache !== false;
  const cacheTtlMs = Math.max(
    0,
    Number(
      env.SIGNAL_SNAPSHOT_CACHE_MS ||
        env.RADAR_SNAPSHOT_CACHE_MS ||
        (driver === 'postgres' ? 10_000 : 0)
    )
  );
  const cacheKey = `${driver}:${safeLimit}`;

  if (cacheEnabled && cacheTtlMs > 0) {
    const cached = persistedSnapshotCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.promise ? await cached.promise : cached.value;
    }
  }

  const loadSnapshot = async () => {
    const fetchLimit = Math.min(Math.max(safeLimit * 20, 200), 2_000);
    const isPostgres = repos.drizzleClient?.driver === 'postgres';
    const loadMetaValues = () =>
      repos.meta.getValues(
        ['latest_snapshot_json', 'last_scanned_at', 'strategy_started_at', 'paper_trade_settings'],
        {
          latest_snapshot_json: null,
          last_scanned_at: null,
          strategy_started_at: null,
          paper_trade_settings: null,
        }
      );

    const loadSnapshotDataWithPostgresFanout = async () => {
      const metaValues = await loadMetaValues();
      const [alertRows, openPositionRows, closedPositionRows, allTradeIntents, summary] =
        await Promise.all([
          repos.alerts.listRecent(fetchLimit),
          repos.positions.listByStatus('open', 20),
          repos.positions.listByStatus('closed', 30),
          repos.tradeIntents.listRecent(fetchLimit),
          repos.alerts.getSummary(),
        ]);

      return [
        metaValues.latest_snapshot_json,
        metaValues.last_scanned_at,
        metaValues.strategy_started_at,
        metaValues.paper_trade_settings,
        alertRows,
        openPositionRows,
        closedPositionRows,
        allTradeIntents,
        summary.totalPersisted,
        summary.totalPersistedTokens,
      ];
    };

    const loadSnapshotDataInParallel = async () => {
      const metaPromise = loadMetaValues();
      const summaryPromise = repos.alerts.getSummary();
      const [metaValues, alertRows, openPositionRows, closedPositionRows, allTradeIntents, summary] =
        await Promise.all([
          metaPromise,
          repos.alerts.listRecent(fetchLimit),
          repos.positions.listByStatus('open', 20),
          repos.positions.listByStatus('closed', 30),
          repos.tradeIntents.listRecent(fetchLimit),
          summaryPromise,
        ]);

      return [
        metaValues.latest_snapshot_json,
        metaValues.last_scanned_at,
        metaValues.strategy_started_at,
        metaValues.paper_trade_settings,
        alertRows,
        openPositionRows,
        closedPositionRows,
        allTradeIntents,
        summary.totalPersisted,
        summary.totalPersistedTokens,
      ];
    };

    const [
      rawSnapshot,
      lastScannedAt,
      strategyStartedAt,
      paperTradeSettingsRaw,
      alertRows,
      openPositionRows,
      closedPositionRows,
      allTradeIntents,
      totalPersisted,
      totalPersistedTokens,
    ] = isPostgres
      ? await loadSnapshotDataWithPostgresFanout()
      : await loadSnapshotDataInParallel();

    const snapshot = parseJsonValue(rawSnapshot, {}) || {};
    const runtimeInfo = getRuntimeInfo(strategyStartedAt || snapshot.strategyStartedAt || null);
    const paperTradeSettings = getPaperTradeSettings(paperTradeSettingsRaw, snapshot.config || {});
    const normalizedOpenPositions = openPositionRows.map(normalizePositionRow);
    const normalizedClosedPositions = closedPositionRows.map(normalizePositionRow);
    const latestPositionMap = buildLatestPositionMap([
      ...normalizedOpenPositions,
      ...normalizedClosedPositions,
    ]);
    const { latestMap: latestTradeIntentMap, signalMap: tradeIntentSignalMap } =
      buildTradeIntentMaps(allTradeIntents);
    const alerts = buildGroupedAlerts(
      alertRows,
      latestTradeIntentMap,
      tradeIntentSignalMap,
      latestPositionMap,
      paperTradeSettings,
      safeLimit
    );
    const paperSummary = buildPaperSummary(normalizedOpenPositions, normalizedClosedPositions);
    const signalTimeline = buildSignalTimeline(alertRows, 1500);

    return {
      ...snapshot,
      pushed: toNumber(snapshot.pushed),
      found: alerts.length,
      scanned: toNumber(snapshot.scanned),
      scannedAt: lastScannedAt || snapshot.scannedAt || null,
      strategyStartedAt: runtimeInfo.strategyStartedAt,
      strategyRuntimeSeconds: runtimeInfo.strategyRuntimeSeconds,
      strategyRuntimeLabel: runtimeInfo.strategyRuntimeLabel,
      persistedThisRound: toNumber(snapshot.persistedThisRound),
      totalPersisted,
      totalPersistedTokens,
      paperSummary,
      paperPositions: normalizedOpenPositions,
      closedPaperPositions: normalizedClosedPositions,
      summary: snapshot.summary || {
        triggered: alerts.length,
        ready: 0,
        watching: 0,
        scanning: 0,
      },
      alerts,
      latestSignal: alerts[0] || null,
      signalTimeline,
      rows: snapshot.rows || [],
      config: {
        ...(snapshot.config || {}),
        paperTradeSettings,
        paperTakeProfitSteps: paperTradeSettings.takeProfitSteps,
        paperStopLossPercent: paperTradeSettings.stopLossPercent,
        paperTrailingStartPercent: paperTradeSettings.trailingStartPercent,
        paperTrailingStopPercent: paperTradeSettings.trailingStopPercent,
        paperTimeStopHours: paperTradeSettings.timeStopHours,
      },
    };
  };

  if (!cacheEnabled || cacheTtlMs <= 0) {
    return loadSnapshot();
  }

  const pendingPromise = loadSnapshot()
    .then((value) => {
      persistedSnapshotCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + cacheTtlMs,
      });
      return value;
    })
    .catch((error) => {
      persistedSnapshotCache.delete(cacheKey);
      throw error;
    });

  persistedSnapshotCache.set(cacheKey, {
    promise: pendingPromise,
    expiresAt: Date.now() + cacheTtlMs,
  });

  return pendingPromise;
}
