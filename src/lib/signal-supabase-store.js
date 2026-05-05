import './signal-env.js';
import { getSupabaseAdmin, isSupabaseEnabled } from './supabase-admin.js';
import { addBn, divBn, mulBn, roundBn, subBn, sumBn } from './bignumber-utils.js';

function assertSupabase() {
  const client = getSupabaseAdmin();
  if (!client) {
    throw new Error('Supabase 未启用，无法执行存储操作');
  }
  return client;
}

function stringifyValue(value) {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function roundTo(value, digits = 2) {
  return roundBn(value, digits);
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

function getRuntimeInfoFromStartedAt(startedAt) {
  const startedAtTs = startedAt ? Math.floor(Date.parse(startedAt) / 1000) : 0;
  const strategyRuntimeSeconds =
    startedAtTs > 0 ? Math.max(0, Math.floor(Date.now() / 1000) - startedAtTs) : 0;

  return {
    strategyStartedAt: startedAt || null,
    strategyRuntimeSeconds,
    strategyRuntimeLabel: formatRuntimeSeconds(strategyRuntimeSeconds),
  };
}

function normalizePaperPositionPayload(position) {
  return {
    id: position.id ?? null,
    chain: position.chain,
    address: position.address,
    name: position.name,
    symbol: position.symbol,
    entrySignalCount: Number(position.entrySignalCount || 0),
    tradeScore: position.tradeScore ?? null,
    positionSizeUsd: Number(position.positionSizeUsd || 0),
    tokenAmount: Number(position.tokenAmount || 0),
    remainingTokenAmount: Number(
      position.remainingTokenAmount ?? position.tokenAmount ?? 0
    ),
    remainingPositionSizeUsd: Number(
      position.remainingPositionSizeUsd ?? position.positionSizeUsd ?? 0
    ),
    realizedPnlUsd: Number(position.realizedPnlUsd || 0),
    realizedProceedsUsd: Number(position.realizedProceedsUsd || 0),
    tpStage: Number(position.tpStage || 0),
    takeProfitSteps: position.takeProfitSteps || [],
    entryPrice: Number(position.entryPrice || 0),
    currentPrice: Number(position.currentPrice || 0),
    takeProfitPct: Number(position.takeProfitPct || 0),
    stopLossPct: Number(position.stopLossPct || 0),
    status: position.status,
    openedAt: position.openedAt || null,
    updatedAt: position.updatedAt || null,
    closedAt: position.closedAt || null,
    closePrice: position.closePrice ?? null,
    closeReason: position.closeReason || '',
    twitter: position.twitter || '',
    pnlPct: Number(position.pnlPct || 0),
    smartMoney: position.smartMoney ?? null,
    buySellRatio: position.buySellRatio ?? null,
    liquidity: position.liquidity ?? null,
    volume: position.volume ?? null,
    currentValueUsd: Number(position.currentValueUsd || 0),
    pnlUsd: Number(position.pnlUsd || 0),
  };
}

function attachSocialLinksToPositions(positions = [], alerts = []) {
  if (!Array.isArray(positions) || positions.length === 0) {
    return [];
  }

  const socialMap = new Map();
  for (const alert of alerts || []) {
    const key = `${alert.chain}:${alert.address}`;
    if (!socialMap.has(key) && alert.twitter) {
      socialMap.set(key, alert.twitter);
    }
  }

  return positions.map((position) => {
    const key = `${position.chain}:${position.address}`;
    return {
      ...position,
      twitter: position.twitter || socialMap.get(key) || '',
    };
  });
}

function toPaperPositionStateEntries(positions, updatedAtTs) {
  return (positions || []).map((position) => ({
    state_key: `paper_position:${position.chain}:${position.address}:${position.entrySignalCount}`,
    state_type: 'paper_position',
    chain: position.chain,
    address: position.address,
    updated_at: updatedAtTs,
    payload: normalizePaperPositionPayload(position),
  }));
}

async function upsertMetaRows(rows) {
  if (!rows.length) {
    return;
  }

  const supabase = assertSupabase();
  const { error } = await supabase.from('radar_meta').upsert(rows, { onConflict: 'key' });
  if (error) {
    throw new Error(`写入 Supabase radar_meta 失败: ${error.message}`);
  }
}

async function getMetaValue(key, fallback = null) {
  const supabase = assertSupabase();
  const { data, error } = await supabase.from('radar_meta').select('value').eq('key', key).maybeSingle();
  if (error) {
    throw new Error(`读取 Supabase radar_meta 失败: ${error.message}`);
  }
  return data?.value ?? fallback;
}

async function updateLatestSnapshot(mutator) {
  const raw = await getMetaValue('latest_snapshot_json', null);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const next = mutator(parsed);
    await upsertMetaRows([{ key: 'latest_snapshot_json', value: JSON.stringify(next) }]);
    return next;
  } catch {
    return null;
  }
}

function toRadarAlertRows(currentAlerts, snapshotAlerts, pushedAtTs) {
  const snapshotMap = new Map(
    (snapshotAlerts || []).map((alert) => [`${alert.chain}:${alert.address}`, alert])
  );

  return currentAlerts.map((alert) => {
    const token = alert.token || {};
    const match = snapshotMap.get(`${token.chain}:${token.address}`) || {};
    const price = token.price || 0;
    return {
      chain: token.chain,
      address: token.address,
      signal_count: alert.signalCount || 1,
      name: token.name,
      symbol: token.symbol,
      price,
      mc: token.mc || 0,
      liq: token.liq || 0,
      volume: token.volume || 0,
      smart_money: token.sm || 0,
      holders: token.holders || 0,
      buy_sell_ratio: match.buySellRatio ?? 0,
      age_hours: token.age_h || 0,
      change_1h: token.chg_1h || 0,
      pct_gain: alert.pctGain || 0,
      stars: alert.stars || 0,
      narrative_tag: alert.narrativeTag || '',
      category: alert.category || '',
      twitter: alert.descInfo?.twitter || token.twitter || '',
      telegram: alert.descInfo?.telegram || token.telegram || '',
      website: alert.descInfo?.website || token.website || '',
      message: alert.msg || '',
      pushed_at: pushedAtTs,
      trade_score: alert.tradePlan?.tradeScore ?? match.tradeScore ?? null,
      trade_status: alert.tradePlan?.intentStatus ?? match.tradeDecisionStatus ?? null,
      trade_reason: alert.tradePlan?.decisionReason ?? match.tradeDecisionReason ?? null,
      trade_decision_at: pushedAtTs,
      paper_position_status: match.paperPositionStatus || null,
      paper_position_size_usd: match.paperPositionSizeUsd ?? null,
      paper_token_amount: match.paperTokenAmount ?? null,
      paper_entry_price: match.paperEntryPrice ?? null,
      paper_current_price: match.paperCurrentPrice ?? null,
      paper_pnl_pct: match.paperPnLPct ?? null,
      paper_opened_at: match.paperOpenedAt ? Math.floor(Date.parse(match.paperOpenedAt) / 1000) : null,
      paper_closed_at: match.paperClosedAt ? Math.floor(Date.parse(match.paperClosedAt) / 1000) : null,
      paper_close_reason: match.paperCloseReason || null,
      paper_take_profit_pct: match.paperTakeProfitPct ?? null,
      paper_stop_loss_pct: match.paperStopLossPct ?? null,
    };
  });
}

function toRadarPositionRows(positions) {
  return (positions || []).map((position) => ({
    chain: position.chain,
    address: position.address,
    name: position.name,
    symbol: position.symbol,
    entry_signal_count: position.entrySignalCount,
    trade_score: position.tradeScore ?? null,
    position_size_usd: position.positionSizeUsd ?? 0,
    token_amount: position.tokenAmount ?? 0,
    entry_price: position.entryPrice ?? 0,
    current_price: position.currentPrice ?? 0,
    take_profit_pct: position.takeProfitPct ?? 0,
    stop_loss_pct: position.stopLossPct ?? 0,
    status: position.status,
    opened_at: position.openedAt ? Math.floor(Date.parse(position.openedAt) / 1000) : 0,
    updated_at: position.updatedAt ? Math.floor(Date.parse(position.updatedAt) / 1000) : 0,
    closed_at: position.closedAt ? Math.floor(Date.parse(position.closedAt) / 1000) : null,
    close_price: position.closePrice ?? null,
    close_reason: position.closeReason || null,
    pnl_pct: position.pnlPct ?? 0,
    smart_money: position.smartMoney ?? null,
    buy_sell_ratio: position.buySellRatio ?? null,
    liquidity: position.liquidity ?? null,
    volume: position.volume ?? null,
  }));
}

async function upsertRadarAlerts(rows) {
  if (!rows.length) {
    return;
  }
  const supabase = assertSupabase();
  const { error } = await supabase.from('radar_alerts').upsert(rows, {
    onConflict: 'chain,address,signal_count',
  });
  if (error) {
    throw new Error(`写入 Supabase radar_alerts 失败: ${error.message}`);
  }
}

async function upsertRadarPositions(rows) {
  if (!rows.length) {
    return;
  }
  const supabase = assertSupabase();
  const { error } = await supabase.from('radar_positions').upsert(rows, {
    onConflict: 'chain,address,entry_signal_count',
  });
  if (error) {
    throw new Error(`写入 Supabase radar_positions 失败: ${error.message}`);
  }
}

async function upsertRuntimeStateEntries(entries) {
  if (!entries.length) {
    return;
  }
  const supabase = assertSupabase();
  const { error } = await supabase.from('radar_runtime_state').upsert(entries, {
    onConflict: 'state_key',
  });
  if (error) {
    throw new Error(`写入 Supabase radar_runtime_state 失败: ${error.message}`);
  }
}

async function getRuntimeStateRows(stateTypes = []) {
  const supabase = assertSupabase();
  let query = supabase
    .from('radar_runtime_state')
    .select('state_key, state_type, chain, address, updated_at, payload')
    .order('updated_at', { ascending: false });

  if (stateTypes.length > 0) {
    query = query.in('state_type', stateTypes);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`读取 Supabase radar_runtime_state 失败: ${error.message}`);
  }

  return data || [];
}

async function syncSupabaseOpenPaperPositionSettings(settings) {
  const normalized = {
    stopLossPercent: Number(settings.stopLossPercent),
    takeProfitSteps: (settings.takeProfitSteps || []).map((step) => ({
      targetPercent: Number(step.targetPercent),
      sellPercent: Number(step.sellPercent),
    })),
  };
  const rows = await getRuntimeStateRows(['paper_position']);
  const entries = rows
    .filter((row) => row.payload?.status === 'open')
    .map((row) => ({
      state_key: row.state_key,
      state_type: row.state_type,
      chain: row.chain,
      address: row.address,
      updated_at: Math.floor(Date.now() / 1000),
      payload: {
        ...row.payload,
        stopLossPct: normalized.stopLossPercent,
        takeProfitPct: normalized.takeProfitSteps[0]?.targetPercent || 0,
        takeProfitSteps: normalized.takeProfitSteps,
      },
    }));

  await upsertRuntimeStateEntries(entries);
}

async function getAlertRows(limit = 50) {
  const fetchLimit = Math.min(Math.max(limit * 20, 200), 2_000);
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from('radar_alerts')
    .select(
      'chain,address,signal_count,name,symbol,price,mc,liq,volume,smart_money,holders,buy_sell_ratio,age_hours,change_1h,pct_gain,stars,narrative_tag,category,twitter,telegram,website,message,pushed_at,trade_score,trade_status,trade_reason,trade_decision_at,paper_position_status,paper_position_size_usd,paper_token_amount,paper_entry_price,paper_current_price,paper_pnl_pct,paper_opened_at,paper_closed_at,paper_close_reason,paper_take_profit_pct,paper_stop_loss_pct'
    )
    .order('pushed_at', { ascending: false })
    .limit(fetchLimit);

  if (error) {
    throw new Error(`读取 Supabase radar_alerts 失败: ${error.message}`);
  }

  return data || [];
}

async function getAlertCount() {
  const supabase = assertSupabase();
  const { count, error } = await supabase
    .from('radar_alerts')
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`统计 Supabase radar_alerts 失败: ${error.message}`);
  }

  return count || 0;
}

export function supabaseStorageEnabled() {
  return isSupabaseEnabled();
}

export async function syncSupabaseRadarSnapshot({
  snapshot,
  currentAlerts = [],
  scannedAtTs = Math.floor(Date.now() / 1000),
  momentumTracker = new Map(),
  momentumPushed = new Map(),
  tokensSeen = new Map(),
  narratives = new Map(),
  paperPositionsState = [],
}) {
  if (!supabaseStorageEnabled() || !snapshot) {
    return false;
  }

  const runtimeEntries = [];
  for (const [address, payload] of momentumTracker.entries()) {
    runtimeEntries.push({
      state_key: `momentum_tracker:${address}`,
      state_type: 'momentum_tracker',
      chain: 'sol',
      address,
      updated_at: scannedAtTs,
      payload: { snapshots: payload },
    });
  }
  for (const [address, payload] of momentumPushed.entries()) {
    runtimeEntries.push({
      state_key: `momentum_pushed:${address}`,
      state_type: 'momentum_pushed',
      chain: 'sol',
      address,
      updated_at: scannedAtTs,
      payload,
    });
  }
  for (const [address, payload] of tokensSeen.entries()) {
    runtimeEntries.push({
      state_key: `token_seen:${address}`,
      state_type: 'token_seen',
      chain: payload.chain || 'sol',
      address,
      updated_at: scannedAtTs,
      payload,
    });
  }
  for (const [theme, payload] of narratives.entries()) {
    runtimeEntries.push({
      state_key: `narrative:${theme}`,
      state_type: 'narrative',
      chain: payload.firstChain || 'sol',
      address: payload.firstTokenAddress || null,
      updated_at: scannedAtTs,
      payload,
    });
  }
  runtimeEntries.push(...toPaperPositionStateEntries(paperPositionsState, scannedAtTs));

  const metaRows = [
    { key: 'latest_snapshot_json', value: stringifyValue(snapshot) },
    { key: 'last_scanned_at', value: snapshot.scannedAt || new Date(scannedAtTs * 1000).toISOString() },
    { key: 'last_scanned_at_ts', value: String(scannedAtTs) },
    { key: 'strategy_started_at', value: snapshot.strategyStartedAt || '' },
    {
      key: 'strategy_started_at_ts',
      value: snapshot.strategyStartedAt ? String(Math.floor(Date.parse(snapshot.strategyStartedAt) / 1000)) : '0',
    },
    {
      key: 'paper_trade_settings',
      value: stringifyValue(snapshot.config?.paperTradeSettings || {}),
    },
  ];

  await upsertMetaRows(metaRows);
  await upsertRadarAlerts(toRadarAlertRows(currentAlerts, snapshot.alerts || [], scannedAtTs));
  await upsertRadarPositions(
    toRadarPositionRows([...(snapshot.paperPositions || []), ...(snapshot.closedPaperPositions || [])])
  );
  await upsertRuntimeStateEntries(runtimeEntries);

  return true;
}

export async function getSupabasePersistedSnapshot(limit = 60) {
  if (!supabaseStorageEnabled()) {
    return null;
  }

  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 120) : 60;
  const [
    raw,
    lastScannedAt,
    strategyStartedAtMeta,
    paperTradeSettings,
    alerts,
    paperSummary,
    paperPositions,
    closedPaperPositions,
    signalTimeline,
    stats,
  ] = await Promise.all([
    getMetaValue('latest_snapshot_json', null),
    getMetaValue('last_scanned_at', null),
    getMetaValue('strategy_started_at', null),
    getSupabasePaperTradeSettings(),
    getSupabasePersistedAlerts(safeLimit),
    getSupabasePaperTradeSummary(),
    getSupabasePaperPositions('open', 20),
    getSupabasePaperPositions('closed', 30),
    getSupabaseSignalTimeline(),
    getSupabaseAlertStats(),
  ]);

  let snapshot = {};
  if (raw) {
    try {
      snapshot = JSON.parse(raw) || {};
    } catch {
      snapshot = {};
    }
  }

  const strategyStartedAt = strategyStartedAtMeta || snapshot.strategyStartedAt || null;
  const runtimeInfo = getRuntimeInfoFromStartedAt(strategyStartedAt);
  const mergedPaperTradeSettings =
    paperTradeSettings || snapshot.config?.paperTradeSettings || null;

  return {
    ...snapshot,
    pushed: Number(snapshot.pushed || 0),
    found: Number(snapshot.found || alerts.length),
    scanned: Number(snapshot.scanned || 0),
    scannedAt: lastScannedAt || snapshot.scannedAt || null,
    persistedThisRound: Number(snapshot.persistedThisRound || 0),
    summary: snapshot.summary || {
      triggered: alerts.length,
      ready: 0,
      watching: 0,
      scanning: 0,
    },
    alerts,
    ...runtimeInfo,
    paperSummary: paperSummary || snapshot.paperSummary,
    paperPositions: attachSocialLinksToPositions(paperPositions, alerts),
    closedPaperPositions: attachSocialLinksToPositions(closedPaperPositions, alerts),
    signalTimeline,
    config: {
      ...(snapshot.config || {}),
      ...(mergedPaperTradeSettings
        ? {
            paperTradeSettings: mergedPaperTradeSettings,
            paperTakeProfitSteps: mergedPaperTradeSettings.takeProfitSteps,
            paperStopLossPercent: mergedPaperTradeSettings.stopLossPercent,
          }
        : {}),
    },
    totalPersisted: stats.totalPersisted || snapshot.totalPersisted || 0,
    totalPersistedTokens: stats.totalPersistedTokens || snapshot.totalPersistedTokens || 0,
  };
}

export async function loadSupabaseRuntimeState() {
  if (!supabaseStorageEnabled()) {
    return null;
  }

  const rows = await getRuntimeStateRows([
    'momentum_tracker',
    'momentum_pushed',
    'token_seen',
    'narrative',
    'paper_position',
  ]);

  const momentumTracker = new Map();
  const momentumPushed = new Map();
  const tokensSeen = new Map();
  const narratives = new Map();
  const paperPositions = new Map();

  for (const row of rows) {
    const payload = row.payload || {};
    switch (row.state_type) {
      case 'momentum_tracker':
        momentumTracker.set(row.address, payload.snapshots || []);
        break;
      case 'momentum_pushed':
        momentumPushed.set(row.address, payload);
        break;
      case 'token_seen':
        tokensSeen.set(row.address, payload);
        break;
      case 'narrative':
        if (payload.theme) {
          narratives.set(payload.theme, payload);
        }
        break;
      case 'paper_position':
        paperPositions.set(row.state_key, payload);
        break;
      default:
        break;
    }
  }

  return {
    momentumTracker,
    momentumPushed,
    tokensSeen,
    narratives,
    paperPositions,
  };
}

export async function getSupabasePaperPositions(status = 'open', limit = 20) {
  if (!supabaseStorageEnabled()) {
    return [];
  }

  const runtimeState = await loadSupabaseRuntimeState();
  const rows = [...(runtimeState?.paperPositions?.values() || [])]
    .filter((position) => position.status === status)
    .sort((left, right) => {
      const leftTime = new Date(left.updatedAt || left.openedAt || 0).getTime();
      const rightTime = new Date(right.updatedAt || right.openedAt || 0).getTime();
      return rightTime - leftTime;
    })
    .slice(0, limit);

  return rows;
}

export async function getSupabasePaperTradeSummary() {
  if (!supabaseStorageEnabled()) {
    return null;
  }

  const runtimeState = await loadSupabaseRuntimeState();
  const rows = [...(runtimeState?.paperPositions?.values() || [])];
  const openRows = rows.filter((row) => row.status === 'open');
  const closedRows = rows.filter((row) => row.status === 'closed');

  const totalOpenedCostUsd = sumBn(rows.map((row) => row.positionSizeUsd || 0));
  const openBuyUsd = sumBn(
    openRows.map((row) => row.remainingPositionSizeUsd ?? row.positionSizeUsd ?? 0)
  );
  const openMarketValueUsd = sumBn(openRows.map((row) => row.currentValueUsd || 0));
  const openRealizedProceedsUsd = sumBn(openRows.map((row) => row.realizedProceedsUsd || 0));
  const openPnLUsd = sumBn(openRows.map((row) => row.pnlUsd || 0));

  const closedBuyUsd = sumBn(closedRows.map((row) => row.positionSizeUsd || 0));
  const closedSellUsd = sumBn(closedRows.map((row) => row.realizedProceedsUsd || 0));
  const closedPnLUsd = sumBn(closedRows.map((row) => row.realizedPnlUsd || 0));

  const totalCapitalUsd = Number(process.env.RADAR_PAPER_TOTAL_CAPITAL_USD || 1000);
  const cashBalanceUsd = addBn(
    subBn(totalCapitalUsd, totalOpenedCostUsd),
    closedSellUsd,
    openRealizedProceedsUsd
  );
  const equityUsd = addBn(cashBalanceUsd, openMarketValueUsd);
  const totalPnLUsd = addBn(openPnLUsd, closedPnLUsd);
  const capitalUsagePct =
    totalCapitalUsd > 0 ? roundTo(mulBn(divBn(openBuyUsd, totalCapitalUsd), 100), 2) : 0;
  const winCount = closedRows.filter((row) => Number(row.pnlPct || 0) > 0).length;

  return {
    openCount: openRows.length,
    closedCount: closedRows.length,
    winCount,
    winRate:
      closedRows.length > 0 ? Number(((winCount / closedRows.length) * 100).toFixed(1)) : 0,
    openValueUsd: roundTo(openMarketValueUsd, 2),
    openCostUsd: roundTo(openBuyUsd, 2),
    openPnLUsd: roundTo(openPnLUsd, 2),
    closedCostUsd: roundTo(closedBuyUsd, 2),
    closedValueUsd: roundTo(closedSellUsd, 2),
    closedPnLUsd: roundTo(closedPnLUsd, 2),
    totalCapitalUsd: roundTo(totalCapitalUsd, 2),
    cashBalanceUsd: roundTo(cashBalanceUsd, 2),
    availableUsd: roundTo(cashBalanceUsd, 2),
    usedCapitalUsd: roundTo(openBuyUsd, 2),
    equityUsd: roundTo(equityUsd, 2),
    capitalUsagePct: roundTo(capitalUsagePct, 2),
    totalPnLUsd: roundTo(totalPnLUsd, 2),
  };
}

export async function getSupabaseSignalTimeline(maxPoints = 1500) {
  if (!supabaseStorageEnabled()) {
    return [];
  }

  const safeLimit = Number.isFinite(maxPoints)
    ? Math.min(Math.max(maxPoints, 100), 5_000)
    : 1500;
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from('radar_alerts')
    .select('name,symbol,address,price,signal_count,pushed_at')
    .order('pushed_at', { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new Error(`读取 Supabase 信号时间线失败: ${error.message}`);
  }

  return (data || []).reverse().map((row, index) => ({
    time: new Date(Number(row.pushed_at || 0) * 1000).toISOString(),
    signalCount: Number(row.signal_count || 0),
    cumulativeCount: index + 1,
    name: row.name,
    symbol: row.symbol,
    address: row.address,
    price: Number(row.price || 0),
  }));
}

export async function getSupabasePersistedAlerts(limit = 50) {
  if (!supabaseStorageEnabled()) {
    return [];
  }

  const rows = await getAlertRows(limit);
  const runtimeState = await loadSupabaseRuntimeState();
  const paperTradeSettings = (await getSupabasePaperTradeSettings()) || {
    takeProfitSteps: [
      { targetPercent: 40, sellPercent: 50 },
      { targetPercent: 100, sellPercent: 30 },
    ],
    stopLossPercent: 40,
    trailingStartPercent: 70,
    trailingStopPercent: 20,
    timeStopHours: 12,
  };

  const positionByAddress = new Map();
  for (const position of runtimeState?.paperPositions?.values() || []) {
    const key = `${position.chain}:${position.address}`;
    const existing = positionByAddress.get(key);
    const currentTime = new Date(position.updatedAt || position.openedAt || 0).getTime();
    const existingTime = existing
      ? new Date(existing.updatedAt || existing.openedAt || 0).getTime()
      : -1;
    if (!existing || currentTime > existingTime) {
      positionByAddress.set(key, position);
    }
  }

  const groups = new Map();
  for (const row of rows) {
    const key = `${row.chain}:${row.address}`;
    const pushedAt = new Date(Number(row.pushed_at || 0) * 1000).toISOString();
    const historyItem = {
      signalCount: Number(row.signal_count || 0),
      pushedAt,
      pctGain: Number(row.pct_gain || 0),
      price: Number(row.price || 0),
    };

    if (!groups.has(key)) {
      if (groups.size >= limit) {
        continue;
      }

      const position = positionByAddress.get(key);
      groups.set(key, {
        address: row.address,
        name: row.name,
        symbol: row.symbol,
        chain: row.chain,
        price: Number(row.price || 0),
        mc: Number(row.mc || 0),
        liq: Number(row.liq || 0),
        volume: Number(row.volume || 0),
        smartMoney: Number(row.smart_money || 0),
        holders: Number(row.holders || 0),
        buySellRatio: Number(row.buy_sell_ratio || 0),
        ageHours: Number(row.age_hours || 0),
        change1h: Number(row.change_1h || 0),
        pctGain: Number(row.pct_gain || 0),
        stars: Number(row.stars || 0),
        narrativeTag: row.narrative_tag,
        category: row.category,
        signalCount: Number(row.signal_count || 0),
        occurrenceCount: 1,
        twitter: row.twitter || '',
        telegram: row.telegram || '',
        website: row.website || '',
        message: row.message,
        pushedAt,
        firstPushedAt: pushedAt,
        latestPushedAt: pushedAt,
        signalHistory: [historyItem],
        tradeScore: row.trade_score ?? null,
        tradeDecisionStatus: row.trade_status || '',
        tradeDecisionReason: row.trade_reason || '',
        tradeDecisionAt: row.trade_decision_at
          ? new Date(Number(row.trade_decision_at) * 1000).toISOString()
          : null,
        paperPositionStatus: position?.status || row.paper_position_status || '',
        paperPositionSizeUsd:
          position?.positionSizeUsd ?? (Number(row.paper_position_size_usd || 0) || null),
        paperTokenAmount:
          position?.tokenAmount ?? (Number(row.paper_token_amount || 0) || null),
        paperEntryPrice:
          position?.entryPrice ?? (Number(row.paper_entry_price || 0) || null),
        paperCurrentPrice:
          position?.currentPrice ?? (Number(row.paper_current_price || 0) || null),
        paperPnLPct: position?.pnlPct ?? (Number(row.paper_pnl_pct || 0) || null),
        paperRealizedPnLUsd: position?.realizedPnlUsd ?? 0,
        paperOpenedAt:
          position?.openedAt ||
          (row.paper_opened_at ? new Date(Number(row.paper_opened_at) * 1000).toISOString() : null),
        paperClosedAt:
          position?.closedAt ||
          (row.paper_closed_at ? new Date(Number(row.paper_closed_at) * 1000).toISOString() : null),
        paperCloseReason: position?.closeReason || row.paper_close_reason || '',
        paperTakeProfitPct:
          position?.takeProfitPct ?? (Number(row.paper_take_profit_pct || 0) || null),
        paperTakeProfitSteps: position?.takeProfitSteps || paperTradeSettings.takeProfitSteps,
        paperTpStage: position?.tpStage ?? 0,
        paperStopLossPct:
          position?.stopLossPct ??
          (Number(row.paper_stop_loss_pct || 0) || paperTradeSettings.stopLossPercent),
      });
      continue;
    }

    const group = groups.get(key);
    group.occurrenceCount += 1;
    group.firstPushedAt = pushedAt;
    group.signalHistory.push(historyItem);
  }

  return [...groups.values()].sort((a, b) => {
    const timeDiff =
      new Date(b.latestPushedAt || b.pushedAt).getTime() -
      new Date(a.latestPushedAt || a.pushedAt).getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }

    if ((b.smartMoney || 0) !== (a.smartMoney || 0)) {
      return (b.smartMoney || 0) - (a.smartMoney || 0);
    }

    if ((b.occurrenceCount || 0) !== (a.occurrenceCount || 0)) {
      return (b.occurrenceCount || 0) - (a.occurrenceCount || 0);
    }

    return (b.pctGain || 0) - (a.pctGain || 0);
  });
}

export async function getSupabaseAlertStats() {
  if (!supabaseStorageEnabled()) {
    return { totalPersisted: 0, totalPersistedTokens: 0 };
  }

  const rows = await getAlertRows(250);
  const totalPersisted = await getAlertCount();
  const totalPersistedTokens = new Set(
    rows.map((row) => `${row.chain}:${row.address}`)
  ).size;

  return {
    totalPersisted,
    totalPersistedTokens,
  };
}

export async function getSupabasePaperTradeSettings() {
  if (!supabaseStorageEnabled()) {
    return null;
  }

  const raw = await getMetaValue('paper_trade_settings', null);
  if (!raw) {
    return null;
  }

  return JSON.parse(raw);
}

export async function updateSupabasePaperTradeSettings(settings, options = {}) {
  if (!supabaseStorageEnabled()) {
    return null;
  }

  const normalized = {
    stopLossPercent: Number(settings.stopLossPercent),
    takeProfitSteps: (settings.takeProfitSteps || []).map((step) => ({
      targetPercent: Number(step.targetPercent),
      sellPercent: Number(step.sellPercent),
    })),
    trailingStartPercent: Number(settings.trailingStartPercent),
    trailingStopPercent: Number(settings.trailingStopPercent),
    timeStopHours: Number(settings.timeStopHours),
  };

  await upsertMetaRows([{ key: 'paper_trade_settings', value: JSON.stringify(normalized) }]);

  if (options.applyToOpenPositions) {
    const supabase = assertSupabase();
    const { error } = await supabase
      .from('radar_positions')
      .update({
        stop_loss_pct: normalized.stopLossPercent,
        take_profit_pct: normalized.takeProfitSteps[0]?.targetPercent || 0,
      })
      .eq('status', 'open');

    if (error) {
      throw new Error(`更新 Supabase 持仓参数失败: ${error.message}`);
    }

    await syncSupabaseOpenPaperPositionSettings(normalized);
  }

  await updateLatestSnapshot((snapshot) => {
    const next = {
      ...snapshot,
      config: {
        ...(snapshot.config || {}),
        paperTradeSettings: normalized,
        paperTakeProfitSteps: normalized.takeProfitSteps,
        paperStopLossPercent: normalized.stopLossPercent,
        paperTrailingStartPercent: normalized.trailingStartPercent,
        paperTrailingStopPercent: normalized.trailingStopPercent,
        paperTimeStopHours: normalized.timeStopHours,
      },
    };

    if (options.applyToOpenPositions) {
      next.paperPositions = (next.paperPositions || []).map((position) => ({
        ...position,
        stopLossPct: normalized.stopLossPercent,
        takeProfitPct: normalized.takeProfitSteps[0]?.targetPercent || 0,
        takeProfitSteps: normalized.takeProfitSteps,
      }));
    }

    return next;
  });

  return normalized;
}

export {
  syncSupabaseRadarSnapshot as syncSupabaseSignalSnapshot,
  getSupabasePersistedSnapshot as getSupabasePersistedSignalSnapshot,
};
