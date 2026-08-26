import './lib/signal-env.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { addBn, divBn, mulBn, roundBn, subBn, sumBn } from './lib/bignumber-utils.js';
import { createOutboundHttpClient } from './lib/outbound-http.js';
import {
  classifyNarrative,
  isSimilarTheme,
  normalizeTheme,
} from './modules/signals/lib/narrative-classifier.js';
import {
  buildLegacyTakeProfitStepsFromEnv,
  normalizeTakeProfitSteps,
  parseTakeProfitStepsFromEnv,
} from './modules/signals/lib/paper-trade-settings.js';
import {
  classifyStars as classifyStarsBase,
  formatMomentumAlert as formatMomentumAlertBase,
} from './modules/signals/lib/telegram-alert-formatter.js';
import {
  COMMON_NOISE_WORDS,
  getBuySellMetrics,
  getPushQualityResult as getPushQualityResultBase,
  passesPushQualityGate as passesPushQualityGateBase,
} from './modules/signals/lib/token-quality.js';
import {
  formatSignalChainList,
  getConfiguredSignalChains,
  getGmgnTokenUrl,
  getSignalChainDefinition,
} from './modules/signals/lib/chain-config.js';
import {
  buildChainTradeRules,
  getPaperBuyExecution,
  getPaperSellExecution,
} from './modules/signals/lib/chain-strategy-config.js';
import {
  buildTradeRulesFromEnv,
  evaluateTradeIntent as evaluateTradeIntentWithRules,
  getTradeScore as getTradeScoreWithRules,
  getTradeScoreHistoryFromAlert,
} from './modules/signals/server/trade-evaluator.js';
import {
  checkTokenSafety as checkTokenSafetyBase,
  fetchTokenDescription as fetchTokenDescriptionBase,
  gmgnGet as gmgnGetBase,
  mapGmgnToken,
} from './modules/signals/server/gmgn-client.js';
import {
  getRadarMeta,
  setRadarMeta,
} from './modules/signals/server/legacy-radar-meta-store.js';
import { createScannerBootstrapService } from './modules/signals/server/scanner-bootstrap-service.js';
import { createScannerConfigService } from './modules/signals/server/scanner-config-service.js';
import { createScannerExternalService } from './modules/signals/server/scanner-external-service.js';
import { createScannerPersistenceService } from './modules/signals/server/scanner-persistence-service.js';
import { createScannerRuntimeMetaService } from './modules/signals/server/scanner-runtime-meta-service.js';
import { createScannerTradeService } from './modules/signals/server/scanner-trade-service.js';
import { createLivePriceSnapshotService } from './modules/signals/server/live-price-snapshot-service.js';
import { createMomentumScannerService } from './modules/signals/server/momentum-scanner-service.js';
import { createPaperPositionLifecycleService } from './modules/signals/server/paper-position-lifecycle-service.js';
import { createPaperTradeSettingsService } from './modules/signals/server/paper-trade-settings-service.js';
import {
  getOpenPaperPositionCountInMemory as getOpenPaperPositionCountInMemoryBase,
  getOpenPaperPositionInMemory as getOpenPaperPositionInMemoryBase,
  getOpenPositionMarkToMarketState as getOpenPositionMarkToMarketStateBase,
  getPaperAccountSummaryFromPositions as getPaperAccountSummaryFromPositionsBase,
  getPositionEntryStage as getPositionEntryStageBase,
  getPositionTargetPositionSizeUsd,
} from './modules/signals/server/paper-position-service.js';
import { createRadarSnapshotService } from './modules/signals/server/radar-snapshot-service.js';
import { createScanOrchestratorService } from './modules/signals/server/scan-orchestrator-service.js';
import {
  createGmgnHeaders,
  createRuntimeTrackers,
  isFileLoggingEnabled,
} from './modules/signals/server/scanner-runtime.js';
import { createRuntimeStateService } from './modules/signals/server/runtime-state-service.js';
import { createTradePlanProcessor } from './modules/signals/server/trade-plan-processor.js';
import {
  readPaperTradeSettingsFromDrizzle,
  readPaperTradeSettingsLockStateFromDrizzle,
  savePaperTradeSettingsToDrizzle,
} from './modules/signals/query/paper-trade-settings-query-service.js';
import {
  readPersistedSignalSnapshotFromDrizzle,
} from './modules/signals/query/persisted-signal-query-service.js';
import { ensurePostgresSchemaReady } from './shared/db/client/postgres.js';
import { createRadarRepositories } from './shared/db/repositories/index.js';

dotenv.config({
  path: path.join(os.homedir(), '.env'),
  override: false,
  quiet: true,
});
dotenv.config({ override: false, quiet: true });

const DEFAULT_DATA_DIR = path.join(process.cwd(), '.signal-scan-data');
let DATA_DIR = process.env.RADAR_DATA_DIR || DEFAULT_DATA_DIR;
const FILE_LOGGING_ENABLED = isFileLoggingEnabled();
const SCAN_INTERVAL = Number(process.env.RADAR_SCAN_INTERVAL || 30);
const MAX_MARKET_CAP = Number(process.env.RADAR_MAX_MC || 10_000_000);
const MIN_MARKET_CAP = Number(process.env.RADAR_MIN_MC || 1_000);
const MIN_LIQUIDITY = Number(process.env.RADAR_MIN_LIQUIDITY || 500);
const PUSH_MIN_LIQUIDITY = Number(process.env.RADAR_PUSH_MIN_LIQUIDITY || 3_000);
const PUSH_MIN_HOLDERS = Number(process.env.RADAR_PUSH_MIN_HOLDERS || 50);
const PUSH_MIN_VOLUME = Number(process.env.RADAR_PUSH_MIN_VOLUME || 10_000);
const PUSH_MIN_BUY_SELL_RATIO = Number(
  process.env.RADAR_PUSH_MIN_BUY_SELL_RATIO || 1.1
);
const REQUIRE_SOCIALS =
  String(process.env.RADAR_REQUIRE_SOCIALS || 'true').toLowerCase() !== 'false';
const MIN_SMART_DEGEN_COUNT = Number(process.env.RADAR_MIN_SMART_DEGEN || 2);
const MOMENTUM_CONSECUTIVE_UP = 3;
const MAX_ALERTS_PER_ROUND = 8;
const SIGNAL_CHAINS = getConfiguredSignalChains();
// Recent strong winners often peak in the mid-60 score range on their first trigger.
const TRADE_RULES = buildTradeRulesFromEnv();
const LEGACY_PAPER_TAKE_PROFIT_PERCENT = Number(process.env.RADAR_PAPER_TP_PERCENT || 50);
const DEFAULT_PAPER_STOP_LOSS_PERCENT = Number(process.env.RADAR_PAPER_SL_PERCENT || 80);
const MAX_PAPER_STOP_LOSS_PERCENT = Number(process.env.RADAR_PAPER_MAX_SL_PERCENT || 80);
const DEFAULT_PAPER_TIME_STOP_HOURS = Number(process.env.RADAR_PAPER_TIME_STOP_HOURS || 0);
const DEFAULT_PAPER_TP1_PROTECTION_PERCENT = Number(
  process.env.SIGNAL_PAPER_TP1_PROTECTION_PERCENT || process.env.RADAR_PAPER_TP1_PROTECTION_PERCENT || 0
);
const DEFAULT_PAPER_FAST_FAILURE_MINUTES = Number(
  process.env.SIGNAL_PAPER_FAST_FAILURE_MINUTES || process.env.RADAR_PAPER_FAST_FAILURE_MINUTES || 0
);
const DEFAULT_PAPER_FAST_FAILURE_LOSS_PERCENT = Number(
  process.env.SIGNAL_PAPER_FAST_FAILURE_LOSS_PERCENT ||
    process.env.RADAR_PAPER_FAST_FAILURE_LOSS_PERCENT ||
    0
);
const DEFAULT_PAPER_TAKE_PROFIT_STEPS = normalizeTakeProfitSteps(
  parseTakeProfitStepsFromEnv(process.env.RADAR_PAPER_TP_STEPS) || buildLegacyTakeProfitStepsFromEnv(),
  roundTo
);
const PAPER_BASE_POSITION_USD = Number(process.env.RADAR_PAPER_BASE_POSITION_USD || 40);
const PAPER_TOTAL_CAPITAL_USD = Number(process.env.RADAR_PAPER_TOTAL_CAPITAL_USD || 1_000);
const PAPER_MAX_OPEN_POSITIONS = Number(process.env.RADAR_PAPER_MAX_OPEN_POSITIONS || 4);
const PAPER_MAX_CAPITAL_USAGE_PCT = Number(
  process.env.RADAR_PAPER_MAX_CAPITAL_USAGE_PCT || 25
);
const PAPER_MAX_SINGLE_POSITION_PCT = Number(
  process.env.RADAR_PAPER_MAX_SINGLE_POSITION_PCT || 10
);
const PAPER_ENTRY_STAGE_ALLOCATIONS = [1];

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT_ID =
  process.env.TG_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '';
const TG_REQUEST_TIMEOUT_MS = Math.max(
  5_000,
  Number(process.env.SIGNAL_TG_TIMEOUT_MS || process.env.RADAR_TG_TIMEOUT_MS || 20_000)
);
const TG_MAX_RETRIES = Math.max(
  0,
  Number(process.env.SIGNAL_TG_MAX_RETRIES || process.env.RADAR_TG_MAX_RETRIES || 2)
);
const TG_RETRY_DELAY_MS = Math.max(
  250,
  Number(process.env.SIGNAL_TG_RETRY_DELAY_MS || process.env.RADAR_TG_RETRY_DELAY_MS || 1_500)
);

const GMGN_HEADERS = createGmgnHeaders();
const SCAN_STAGE_DEBUG_ENABLED =
  String(process.env.SIGNAL_SCAN_DEBUG || process.env.RADAR_SCAN_DEBUG || 'false').toLowerCase() ===
  'true';
const {
  momentumTracker: MOMENTUM_TRACKER,
  momentumPushed: MOMENTUM_PUSHED,
  tokensSeenRuntime: TOKENS_SEEN_RUNTIME,
  narrativesRuntime: NARRATIVES_RUNTIME,
} = createRuntimeTrackers();
const { fetchJson, fetchWithEnv } = createOutboundHttpClient();
const RADAR_REPOSITORIES = createRadarRepositories();

async function ensureRadarStorageReady() {
  await ensurePostgresSchemaReady(RADAR_REPOSITORIES.drizzleClient);
}

function chunkArray(items = [], size = 100) {
  if (!Array.isArray(items) || !items.length) {
    return [];
  }

  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function buildValuesClause(rows, columnCount) {
  const params = [];
  const valuesSql = rows
    .map((row, rowIndex) => {
      const placeholders = row.map((value, columnIndex) => {
        params.push(value);
        return `$${rowIndex * columnCount + columnIndex + 1}`;
      });
      return `(${placeholders.join(', ')})`;
    })
    .join(', ');

  return {
    params,
    valuesSql,
  };
}

async function flushPersistedRuntimeStatePostgres(runtimeState, touchedTokenAddresses, touchedNarrativeThemes) {
  const sqlClient = RADAR_REPOSITORIES.drizzleClient?.client;
  if (!sqlClient) {
    throw new Error('PostgreSQL client 不可用，无法批量回写 runtime state');
  }

  const tokenRows = touchedTokenAddresses
    .map((address) => {
      const row = runtimeState.tokensSeen.get(address);
      if (!row) {
        return null;
      }

      return [
        address,
        row.chain || null,
        row.name || null,
        row.symbol || null,
        row.narrativeTheme || row.theme || null,
        row.category || null,
        Number(row.firstSeenAt || Math.floor(Date.now() / 1000)),
        Number(row.marketCap || 0),
        row.pushed ? 1 : 0,
        Number(row.seenCount || 1),
      ];
    })
    .filter(Boolean);

  for (const chunk of chunkArray(tokenRows, 100)) {
    const { valuesSql, params } = buildValuesClause(chunk, 10);
    await sqlClient.unsafe(
      `
        INSERT INTO radar_tokens_seen (
          address,
          chain,
          name,
          symbol,
          narrative_theme,
          category,
          first_seen_at,
          market_cap,
          pushed,
          seen_count
        )
        VALUES ${valuesSql}
        ON CONFLICT (address) DO UPDATE SET
          chain = EXCLUDED.chain,
          name = EXCLUDED.name,
          symbol = EXCLUDED.symbol,
          narrative_theme = EXCLUDED.narrative_theme,
          category = EXCLUDED.category,
          first_seen_at = EXCLUDED.first_seen_at,
          market_cap = EXCLUDED.market_cap,
          pushed = EXCLUDED.pushed,
          seen_count = EXCLUDED.seen_count
      `,
      params
    );
  }

  const existingNarrativeRows = [];
  const newNarrativeRows = [];
  for (const theme of touchedNarrativeThemes) {
    const row = runtimeState.narratives.get(theme);
    if (!row || !theme) {
      continue;
    }

    const payload = [
      theme,
      row.firstTokenName || null,
      row.firstTokenAddress || null,
      row.firstChain || null,
      Number(row.firstSeenAt || Math.floor(Date.now() / 1000)),
      Number(row.tokenCount || 1),
      Number(row.lastSeenAt || Math.floor(Date.now() / 1000)),
    ];

    if (row._persisted && row.id != null) {
      existingNarrativeRows.push([row.id, ...payload]);
    } else {
      newNarrativeRows.push(payload);
    }
  }

  for (const chunk of chunkArray(existingNarrativeRows, 100)) {
    const { valuesSql, params } = buildValuesClause(chunk, 8);
    await sqlClient.unsafe(
      `
        UPDATE radar_narratives AS target
        SET
          theme = source.theme,
          first_token_name = source.first_token_name,
          first_token_address = source.first_token_address,
          first_chain = source.first_chain,
          first_seen_at = source.first_seen_at,
          token_count = source.token_count,
          last_seen_at = source.last_seen_at
        FROM (
          SELECT
            value.id::bigint AS id,
            value.theme::text AS theme,
            value.first_token_name::text AS first_token_name,
            value.first_token_address::text AS first_token_address,
            value.first_chain::text AS first_chain,
            value.first_seen_at::bigint AS first_seen_at,
            value.token_count::integer AS token_count,
            value.last_seen_at::bigint AS last_seen_at
          FROM (
            VALUES ${valuesSql}
          ) AS value (
            id,
            theme,
            first_token_name,
            first_token_address,
            first_chain,
            first_seen_at,
            token_count,
            last_seen_at
          )
        ) AS source
        WHERE target.id = source.id
      `,
      params
    );
  }

  for (const chunk of chunkArray(newNarrativeRows, 100)) {
    const { valuesSql, params } = buildValuesClause(chunk, 7);
    const insertedRows = await sqlClient.unsafe(
      `
        INSERT INTO radar_narratives (
          theme,
          first_token_name,
          first_token_address,
          first_chain,
          first_seen_at,
          token_count,
          last_seen_at
        )
        VALUES ${valuesSql}
        RETURNING id, theme
      `,
      params
    );

    for (const inserted of insertedRows) {
      const existing = runtimeState.narratives.get(inserted.theme);
      if (!existing) {
        continue;
      }
      runtimeState.narratives.set(inserted.theme, {
        ...existing,
        id: inserted.id,
        _persisted: true,
      });
    }
  }

  for (const address of touchedTokenAddresses) {
    const row = runtimeState.tokensSeen.get(address);
    if (row) {
      row._persisted = true;
    }
  }
}

async function preparePersistedRuntimeState(tokens = []) {
  const addresses = [...new Set(tokens.map((token) => token.address).filter(Boolean))];
  const [tokenRows, narrativeRows] = await Promise.all([
    RADAR_REPOSITORIES.tokensSeen.findByAddresses(addresses),
    RADAR_REPOSITORIES.narratives.listRecent(1000),
  ]);

  return {
    momentumTracker: new Map(),
    momentumPushed: new Map(),
    tokensSeen: new Map(
      tokenRows.map((row) => [
        row.address,
        {
          ...row,
          theme: row.narrativeTheme || '',
          _persisted: true,
        },
      ])
    ),
    narratives: new Map(
      narrativeRows.map((row) => [
        row.theme,
        {
          ...row,
          _persisted: true,
        },
      ])
    ),
    touchedTokenAddresses: new Set(),
    touchedNarrativeThemes: new Set(),
  };
}

async function flushPersistedRuntimeState(runtimeState) {
  if (!runtimeState) {
    return;
  }

  const touchedTokenAddresses = [...(runtimeState.touchedTokenAddresses || [])];
  const touchedNarrativeThemes = [...(runtimeState.touchedNarrativeThemes || [])];
  if (SCAN_STAGE_DEBUG_ENABLED) {
    log(
      `[flush-runtime] start tokens=${touchedTokenAddresses.length} narratives=${touchedNarrativeThemes.length}`
    );
  }

  if (RADAR_REPOSITORIES.drizzleClient?.driver === 'postgres') {
    await flushPersistedRuntimeStatePostgres(
      runtimeState,
      touchedTokenAddresses,
      touchedNarrativeThemes
    );
    if (SCAN_STAGE_DEBUG_ENABLED) {
      log('[flush-runtime] done');
    }
    return;
  }

  let tokenIndex = 0;
  for (const address of touchedTokenAddresses) {
    tokenIndex += 1;
    const row = runtimeState.tokensSeen.get(address);
    if (!row) {
      continue;
    }

    const payload = {
      chain: row.chain || null,
      name: row.name || null,
      symbol: row.symbol || null,
      narrativeTheme: row.narrativeTheme || row.theme || null,
      category: row.category || null,
      firstSeenAt: Number(row.firstSeenAt || Math.floor(Date.now() / 1000)),
      marketCap: Number(row.marketCap || 0),
      pushed: row.pushed ? 1 : 0,
      seenCount: Number(row.seenCount || 1),
    };

    if (row._persisted) {
      await RADAR_REPOSITORIES.tokensSeen.updateByAddress(address, payload);
    } else {
      await RADAR_REPOSITORIES.tokensSeen.insert({
        address,
        ...payload,
      });
      row._persisted = true;
    }

    if (
      SCAN_STAGE_DEBUG_ENABLED &&
      (tokenIndex === 1 || tokenIndex % 10 === 0 || tokenIndex === touchedTokenAddresses.length)
    ) {
      log(`[flush-runtime] tokens progress ${tokenIndex}/${touchedTokenAddresses.length}`);
    }
  }

  let narrativeIndex = 0;
  for (const theme of touchedNarrativeThemes) {
    narrativeIndex += 1;
    const row = runtimeState.narratives.get(theme);
    if (!row || !theme) {
      continue;
    }

    const payload = {
      theme,
      firstTokenName: row.firstTokenName || null,
      firstTokenAddress: row.firstTokenAddress || null,
      firstChain: row.firstChain || null,
      firstSeenAt: Number(row.firstSeenAt || Math.floor(Date.now() / 1000)),
      tokenCount: Number(row.tokenCount || 1),
      lastSeenAt: Number(row.lastSeenAt || Math.floor(Date.now() / 1000)),
    };

    if (row._persisted && row.id != null) {
      await RADAR_REPOSITORIES.narratives.updateById(row.id, payload);
    } else {
      const inserted = await RADAR_REPOSITORIES.narratives.insert(payload);
      runtimeState.narratives.set(theme, {
        ...(inserted || payload),
        _persisted: true,
      });
    }

    if (
      SCAN_STAGE_DEBUG_ENABLED &&
      (narrativeIndex === 1 ||
        narrativeIndex % 10 === 0 ||
        narrativeIndex === touchedNarrativeThemes.length)
    ) {
      log(
        `[flush-runtime] narratives progress ${narrativeIndex}/${touchedNarrativeThemes.length}`
      );
    }
  }

  if (SCAN_STAGE_DEBUG_ENABLED) {
    log('[flush-runtime] done');
  }
}

function roundTo(value, digits = 2) {
  return roundBn(value || 0, digits);
}

function formatCompactPrice(price) {
  const value = Number(price || 0);
  if (value <= 0) {
    return '--';
  }
  if (value >= 1) {
    return value.toFixed(4);
  }
  if (value >= 0.01) {
    return value.toFixed(6);
  }
  return value.toFixed(8);
}

function compareSignalPriority(left, right) {
  if ((right?.token?.sm || 0) !== (left?.token?.sm || 0)) {
    return (right?.token?.sm || 0) - (left?.token?.sm || 0);
  }
  if ((right?.signalCount || 0) !== (left?.signalCount || 0)) {
    return (right?.signalCount || 0) - (left?.signalCount || 0);
  }
  if ((right?.pctGain || 0) !== (left?.pctGain || 0)) {
    return (right?.pctGain || 0) - (left?.pctGain || 0);
  }
  return String(left?.token?.address || '').localeCompare(String(right?.token?.address || ''));
}

function getPriceActionScore(token, pctGain, rounds, volUp) {
  let score = 0;
  const smartMoney = Number(token.sm || 0);
  const volume = Number(token.volume || 0);
  const liquidity = Number(token.liq || 0);
  const oneHourChange = Number(token.chg_1h || 0);
  const buySellRatio = Number(getBuySellMetrics(token).buySellRatio || 0);

  if (rounds >= 3) {
    score += 20;
  } else if (rounds >= 2) {
    score += 10;
  }

  if (pctGain >= 30) {
    score += 25;
  } else if (pctGain >= 15) {
    score += 18;
  } else if (pctGain >= 8) {
    score += 12;
  } else if (pctGain >= 5) {
    score += 8;
  }

  if (volUp) {
    score += 10;
  }

  if (smartMoney >= 5) {
    score += 15;
  } else if (smartMoney >= 3) {
    score += 10;
  } else if (smartMoney >= 2) {
    score += 6;
  }

  if (buySellRatio >= 1.5) {
    score += 12;
  } else if (buySellRatio >= 1.2) {
    score += 8;
  } else if (buySellRatio >= 1.1) {
    score += 5;
  }

  if (volume >= 100_000) {
    score += 10;
  } else if (volume >= 30_000) {
    score += 6;
  }

  if (liquidity >= 20_000) {
    score += 8;
  } else if (liquidity >= 10_000) {
    score += 5;
  }

  if (oneHourChange >= 80) {
    score -= 15;
  } else if (oneHourChange >= 50) {
    score -= 8;
  }

  const finalScore = Math.max(0, Math.min(100, roundTo(score, 0)));
  let label = '观察';
  if (finalScore >= 80) {
    label = '强势';
  } else if (finalScore >= 65) {
    label = '偏强';
  } else if (finalScore >= 50) {
    label = '中性';
  }

  return {
    score: finalScore,
    label,
  };
}

function ensureDataDir() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (error) {
    if (DATA_DIR !== DEFAULT_DATA_DIR) {
      DATA_DIR = DEFAULT_DATA_DIR;
      fs.mkdirSync(DATA_DIR, { recursive: true });
      return;
    }
    throw error;
  }
}

function log(message) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const line = `[${ts}] ${message}`;
  console.log(line);
  if (!FILE_LOGGING_ENABLED) {
    return;
  }

  ensureDataDir();
  fs.appendFileSync(path.join(DATA_DIR, 'signal_scan.log'), `${line}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildDashboardSummary(rows = []) {
  return {
    triggered: rows.filter((row) => row.status === 'triggered').length,
    ready: rows.filter((row) => row.status === 'ready').length,
    watching: rows.filter((row) => row.status === 'watching').length,
    scanning: rows.filter((row) => row.status === 'scanning').length,
  };
}

function normalizeRepositoryPositionForSummary(row) {
  const currentPrice = Number(row.currentPrice || 0);
  const positionSizeUsd = Number(row.positionSizeUsd || 0);
  const tokenAmount = Number(row.tokenAmount || 0);
  const remainingTokenAmount = Number(row.remainingTokenAmount ?? tokenAmount ?? 0);
  const remainingPositionSizeUsd = Number(row.remainingPositionSizeUsd ?? positionSizeUsd ?? 0);
  const currentValueUsd = roundTo(mulBn(remainingTokenAmount, currentPrice), 2);
  const realizedPnlUsd = Number(row.realizedPnlUsd || 0);
  const pnlUsd = roundTo(addBn(realizedPnlUsd, subBn(currentValueUsd, remainingPositionSizeUsd)), 2);

  return {
    status: row.status,
    positionSizeUsd,
    remainingPositionSizeUsd,
    currentValueUsd,
    realizedProceedsUsd: Number(row.realizedProceedsUsd || 0),
    realizedPnlUsd,
    pnlUsd,
    pnlPct: Number(row.pnlPct || 0),
  };
}

async function getPaperAccountSummaryForStorage(db, options = {}) {
  const repos = options.repositories;
  if (!repos) {
    return getPaperAccountSummary(db);
  }

  const rows = await repos.positions.listAll();
  return getPaperAccountSummaryFromPositions(
    rows.map(normalizeRepositoryPositionForSummary)
  );
}

async function getRecentTradeScoresForStorage(
  db,
  chain,
  address,
  limit = TRADE_RULES.scoreAverageLookback - 1,
  options = {}
) {
  const repos = options.repositories;
  if (!repos) {
    return getRecentTradeScores(db, chain, address, limit);
  }

  const rows = await repos.tradeIntents.listScores(chain, address, limit);
  return rows
    .map((row) => Number(row.tradeScore))
    .filter((score) => Number.isFinite(score))
    .reverse();
}

async function recordTradeIntentForStorage(db, alert, tradePlan, createdAt, options = {}) {
  const repos = options.repositories;
  if (!repos) {
    return recordTradeIntent(db, alert, tradePlan, createdAt);
  }

  const rounds = Number(alert.rounds || alert.signalCount || 1);
  const priceScore = getPriceActionScore(
    {
      ...alert.token,
      buySellRatio: tradePlan.buySellRatio,
    },
    alert.pctGain,
    rounds,
    Boolean(alert.volUp)
  ).score;

  await repos.tradeIntents.insertMany([
    {
      chain: alert.token.chain,
      address: alert.token.address,
      signalCount: alert.signalCount,
      name: alert.token.name,
      symbol: alert.token.symbol,
      tradeScore: tradePlan.tradeScore,
      priceScore,
      rounds,
      status: tradePlan.intentStatus,
      decisionReason: tradePlan.decisionReason,
      smartMoney: alert.token.sm || 0,
      buySellRatio: tradePlan.buySellRatio,
      liquidity: alert.token.liq || 0,
      volume: alert.token.volume || 0,
      price: alert.token.price || 0,
      createdAt,
    },
  ]);
}

async function ensureDrizzleStrategySessionMeta(repositories, { reset = false } = {}) {
  const existingStartedAtTs = await repositories.meta.getValue('strategy_started_at_ts', null);
  if (existingStartedAtTs && !reset) {
    return;
  }

  const nowTs = Math.floor(Date.now() / 1000);
  await repositories.meta.setValues([
    { key: 'strategy_started_at_ts', value: String(nowTs) },
    { key: 'strategy_started_at', value: new Date(nowTs * 1000).toISOString() },
  ]);
}

async function ensureStrategySessionMetaForStorage(db, options = {}) {
  if (db) {
    return ensureStrategySessionMeta(db, options);
  }
  return ensureDrizzleStrategySessionMeta(RADAR_REPOSITORIES, options);
}

async function buildDrizzleLocalResult({
  currentAlerts,
  dashboardRows,
  rowLimit,
  scannedAt,
  scannedAtTs,
  tokens,
}) {
  const runBuildStage = async (name, work) => {
    const startedAt = Date.now();
    try {
      return await work();
    } finally {
      if (SCAN_STAGE_DEBUG_ENABLED) {
        log(`[build-local-result] ${name} 完成，耗时 ${Date.now() - startedAt}ms`);
      }
    }
  };

  await runBuildStage('ensureStrategySessionMeta', () =>
    ensureDrizzleStrategySessionMeta(RADAR_REPOSITORIES)
  );
  await runBuildStage('setScanMeta', () =>
    RADAR_REPOSITORIES.meta.setValues([
      { key: 'last_scanned_at', value: scannedAt },
      { key: 'last_scanned_at_ts', value: String(scannedAtTs) },
    ])
  );

  const settings = await runBuildStage('getStoredPaperTradeSettings', () =>
    getStoredPaperTradeSettings()
  );

  const openPositions = await RADAR_REPOSITORIES.positions.listByStatus('open', 0);
  const trackedTokens = openPositions.map((p) => ({ chain: p.chain, address: p.address }));
  const livePriceMap = await runBuildStage('fetchTrackedLivePrices', () =>
    fetchTrackedLivePrices(trackedTokens)
  );

  const enrichedTokens = [...tokens];
  for (const position of openPositions) {
    const key = `${position.chain}:${position.address}`;
    const livePrice = livePriceMap.get(key);
    if (livePrice != null && !enrichedTokens.some((t) => t.address === position.address)) {
      enrichedTokens.push({
        chain: position.chain,
        address: position.address,
        price: livePrice,
        name: position.name,
        symbol: position.symbol,
      });
    } else if (livePrice != null) {
      const token = enrichedTokens.find((t) => t.address === position.address);
      if (token) {
        token.price = livePrice;
      }
    }
  }

  await runBuildStage('processTradePlans', () =>
    processTradePlans(null, currentAlerts, enrichedTokens, scannedAtTs, {
      repositories: RADAR_REPOSITORIES,
      settings,
    })
  );
  await runBuildStage('refreshAlertMessages', async () => {
    for (const alert of currentAlerts) {
      const rounds = Number(alert.rounds || alert.signalCount || 1);
      const priceActionScore = getPriceActionScore(
        alert.token,
        alert.pctGain,
        rounds,
        Boolean(alert.volUp)
      );
      alert.msg = formatMomentumAlert(
        alert.token,
        alert.pctGain,
        rounds,
        Boolean(alert.volUp),
        alert.stars,
        alert.narrativeTag,
        alert.descInfo,
        alert.signalCount,
        {
          tradeScoreOverride: alert.tradePlan?.tradeScore ?? null,
          priceActionScoreOverride: priceActionScore,
        }
      );
    }
  });
  const persistedThisRound = await runBuildStage('persistAlerts', () =>
    persistAlerts(null, currentAlerts, scannedAtTs, {
      repositories: RADAR_REPOSITORIES,
    })
  );
  const snapshot = await runBuildStage('readPersistedSignalSnapshot', () =>
    readPersistedSignalSnapshotFromDrizzle(rowLimit, {
      repositories: RADAR_REPOSITORIES,
      cache: false,
    })
  );

  return {
    ...snapshot,
    found: currentAlerts.length,
    scanned: tokens.length,
    scannedAt: snapshot.scannedAt || scannedAt,
    persistedThisRound,
    rows: dashboardRows,
    summary: buildDashboardSummary(dashboardRows),
  };
}

const {
  ensureStrategySessionMeta,
  getPositionEntryStage,
  getStrategyRuntimeInfo,
  getStrategyRuntimeInfoFromStartedAt,
} = createScannerRuntimeMetaService({
  entryStageAllocations: PAPER_ENTRY_STAGE_ALLOCATIONS,
  getPositionEntryStageBase,
  getRadarMeta,
  setRadarMeta,
});

const {
  formatPaperTradePolicyLabel,
  getPaperTradeSettings,
  getPositionTakeProfitSteps,
  normalizePaperTradeSettings,
} = createPaperTradeSettingsService({
  defaultPaperStopLossPercent: DEFAULT_PAPER_STOP_LOSS_PERCENT,
  defaultPaperTakeProfitSteps: DEFAULT_PAPER_TAKE_PROFIT_STEPS,
  defaultPaperTimeStopHours: DEFAULT_PAPER_TIME_STOP_HOURS,
  defaultPaperTp1ProtectionPercent: DEFAULT_PAPER_TP1_PROTECTION_PERCENT,
  defaultPaperFastFailureMinutes: DEFAULT_PAPER_FAST_FAILURE_MINUTES,
  defaultPaperFastFailureLossPercent: DEFAULT_PAPER_FAST_FAILURE_LOSS_PERCENT,
  maxPaperStopLossPercent: MAX_PAPER_STOP_LOSS_PERCENT,
  legacyPaperTakeProfitPercent: LEGACY_PAPER_TAKE_PROFIT_PERCENT,
  roundTo,
  getRadarMeta,
  setRadarMeta,
});

const {
  evaluateTradeIntent,
  getPaperAccountSummary,
  getRecentTradeScores,
  getTradeScore,
  recordTradeIntent,
} = createScannerTradeService({
  addBn,
  divBn,
  evaluateTradeIntentWithRules,
  getBuySellMetrics,
  getTradeScoreWithRules,
  mulBn,
  paperTotalCapitalUsd: PAPER_TOTAL_CAPITAL_USD,
  roundTo,
  rules: TRADE_RULES,
  resolveRules: (chain) => buildChainTradeRules(chain, TRADE_RULES),
  subBn,
  sumBn,
});

const {
  checkTokenSafety,
  classifyStars,
  fetchTokenDescription,
  formatMomentumAlert,
  gmgnGet,
  mapToken,
  tgSend,
} = createScannerExternalService({
  TG_CHAT_ID,
  tgMaxRetries: TG_MAX_RETRIES,
  tgRequestTimeoutMs: TG_REQUEST_TIMEOUT_MS,
  tgRetryDelayMs: TG_RETRY_DELAY_MS,
  TG_TOKEN,
  checkTokenSafetyBase,
  classifyStarsBase,
  commonNoiseWords: COMMON_NOISE_WORDS,
  fetchJson,
  fetchWithEnv,
  fetchTokenDescriptionBase,
  formatCompactPrice,
  formatMomentumAlertBase,
  getGmgnTokenUrl,
  getPriceActionScore,
  getTradeScore,
  gmgnGetBase,
  headers: GMGN_HEADERS,
  log,
  mapGmgnToken,
  normalizeTheme,
  sleep,
});

const {
  fetchNewTokens,
  getMomentumState,
  getPushQualityResult,
  trackMomentum,
} = createMomentumScannerService({
  checkTokenSafety,
  classifyNarrative,
  classifyStars,
  fetchTokenDescription,
  formatMomentumAlert,
  getPushQualityResultBase,
  gmgnGet,
  log,
  mapToken,
  momentumConsecutiveUp: MOMENTUM_CONSECUTIVE_UP,
  momentumPushed: MOMENTUM_PUSHED,
  momentumTracker: MOMENTUM_TRACKER,
  minLiquidity: MIN_LIQUIDITY,
  minMarketCap: MIN_MARKET_CAP,
  minSmartDegenCount: MIN_SMART_DEGEN_COUNT,
  maxMarketCap: MAX_MARKET_CAP,
  passesPushQualityGateBase,
  pushMinBuySellRatio: PUSH_MIN_BUY_SELL_RATIO,
  pushMinHolders: PUSH_MIN_HOLDERS,
  pushMinLiquidity: PUSH_MIN_LIQUIDITY,
  pushMinVolume: PUSH_MIN_VOLUME,
  requireSocials: REQUIRE_SOCIALS,
  sleep,
  chains: SIGNAL_CHAINS,
});

const {
  buildDashboardRows,
  createEmptyRadarSnapshot,
  getPaperPositions,
  getPaperTradeSummary,
  getRecentPersistedAlerts,
  getSignalTimeline,
} = createRadarSnapshotService({
  addBn,
  classifyNarrative,
  classifyStars,
  evaluateTradeIntent,
  getMomentumState,
  getPaperAccountSummary,
  getPaperAccountSummaryFromPositions,
  getPaperTradeSettings,
  getPositionTakeProfitSteps,
  getPushQualityResult,
  getRadarConfig: (...args) => getRadarConfig(...args),
  getStrategyRuntimeInfoFromStartedAt,
  getTradeScoreHistoryFromAlert,
  legacyPaperTakeProfitPercent: LEGACY_PAPER_TAKE_PROFIT_PERCENT,
  minSmartDegenCount: MIN_SMART_DEGEN_COUNT,
  momentumConsecutiveUp: MOMENTUM_CONSECUTIVE_UP,
  momentumPushed: MOMENTUM_PUSHED,
  mulBn,
  normalizePaperTradeSettings,
  paperEntryStageAllocations: PAPER_ENTRY_STAGE_ALLOCATIONS,
  roundTo,
  subBn,
  sumBn,
});

const { checkNarrativeNovelty, isTokenSeen, recordToken } = createRuntimeStateService({
  isSimilarTheme,
  momentumPushed: MOMENTUM_PUSHED,
  momentumTracker: MOMENTUM_TRACKER,
  narrativesRuntime: NARRATIVES_RUNTIME,
  repositories: RADAR_REPOSITORIES,
  tokensSeenRuntime: TOKENS_SEEN_RUNTIME,
});

const {
  getPersistedRadarSnapshot,
  persistAlerts,
} = createScannerPersistenceService({
  createEmptyRadarSnapshot,
  getBuySellMetrics,
  getStoredPaperTradeSettings,
  readPersistedSignalSnapshot: (limit) =>
    readPersistedSignalSnapshotFromDrizzle(limit, { repositories: RADAR_REPOSITORIES }),
});

const { getRealtimeRadarSnapshot, fetchTrackedLivePrices } = createLivePriceSnapshotService({
  addBn,
  divBn,
  fetchJson,
  fetchNewTokens,
  getPersistedRadarSnapshot,
  mulBn,
  paperTotalCapitalUsd: PAPER_TOTAL_CAPITAL_USD,
  roundTo,
  subBn,
  sumBn,
});

const {
  getOpenPaperPosition,
  getOpenPaperPositionCount,
  getPaperEntrySizing,
  getPaperPositionSizingByMetrics,
  manuallyClosePaperPositions,
  openPaperPosition,
  openPaperPositionInMemory,
  scaleIntoPaperPosition,
  scaleIntoPaperPositionInMemory,
  updatePaperPositions,
  updatePaperPositionsInMemory,
} = createPaperPositionLifecycleService({
  addBn,
  divBn,
  getOpenPaperPositionCountInMemory,
  getOpenPaperPositionInMemory,
  getOpenPositionMarkToMarketState,
  getPaperTradeSettings,
  getPositionEntryStage,
  getPositionTakeProfitSteps,
  getPositionTargetPositionSizeUsd,
  legacyPaperTakeProfitPercent: LEGACY_PAPER_TAKE_PROFIT_PERCENT,
  mulBn,
  normalizePaperTradeSettings,
  paperBasePositionUsd: PAPER_BASE_POSITION_USD,
  paperEntryStageAllocations: PAPER_ENTRY_STAGE_ALLOCATIONS,
  paperMaxSinglePositionPct: PAPER_MAX_SINGLE_POSITION_PCT,
  paperTotalCapitalUsd: PAPER_TOTAL_CAPITAL_USD,
  roundTo,
  subBn,
  fetchTrackedLivePrices,
  getBuyExecution: getPaperBuyExecution,
  getSellExecution: getPaperSellExecution,
});

const { getRadarConfig } = createScannerConfigService({
  defaultScanConfig: {
    scanInterval: SCAN_INTERVAL,
    chains: SIGNAL_CHAINS,
    chainLabel: formatSignalChainList(SIGNAL_CHAINS),
    minMarketCap: MIN_MARKET_CAP,
    maxMarketCap: MAX_MARKET_CAP,
    minLiquidity: MIN_LIQUIDITY,
    minSmartDegenCount: MIN_SMART_DEGEN_COUNT,
    pushMinLiquidity: PUSH_MIN_LIQUIDITY,
    pushMinHolders: PUSH_MIN_HOLDERS,
    pushMinVolume: PUSH_MIN_VOLUME,
    pushMinBuySellRatio: PUSH_MIN_BUY_SELL_RATIO,
    requireSocials: REQUIRE_SOCIALS,
    momentumConsecutiveUp: MOMENTUM_CONSECUTIVE_UP,
    tradeScoreThreshold: TRADE_RULES.scoreThreshold,
    tradeMinSmartMoney: TRADE_RULES.minSmartMoney,
    tradeMaxSignalCount: TRADE_RULES.maxSignalCount,
    tradeHeadEntrySignalCount: TRADE_RULES.headEntrySignalCount,
    tradeMinLiquidity: TRADE_RULES.minLiquidity,
    tradeMinVolume: TRADE_RULES.minVolume,
    tradeMinBuySellRatio: TRADE_RULES.minBuySellRatio,
    tradeMaxTokenAgeHours: TRADE_RULES.maxTokenAgeHours,
    tradeHotModeChange1h: TRADE_RULES.hotModeChange1h,
    tradeHotModeMinSmartMoney: TRADE_RULES.hotModeMinSmartMoney,
    tradeHotModeMinLiquidity: TRADE_RULES.hotModeMinLiquidity,
    tradeHotModeMinBuySellRatio: TRADE_RULES.hotModeMinBuySellRatio,
    tradeHotModeMinScore: TRADE_RULES.hotModeMinScore,
    tradeSecondHeadMinScore: TRADE_RULES.secondHeadMinScore,
    tradeSecondHeadMinScoreDelta: TRADE_RULES.secondHeadMinScoreDelta,
    paperTakeProfitPercent: LEGACY_PAPER_TAKE_PROFIT_PERCENT,
    paperBasePositionUsd: PAPER_BASE_POSITION_USD,
    paperTotalCapitalUsd: PAPER_TOTAL_CAPITAL_USD,
    paperMaxOpenPositions: PAPER_MAX_OPEN_POSITIONS,
    paperMaxCapitalUsagePct: PAPER_MAX_CAPITAL_USAGE_PCT,
    paperMaxSinglePositionPct: PAPER_MAX_SINGLE_POSITION_PCT,
    paperEntryStageAllocations: PAPER_ENTRY_STAGE_ALLOCATIONS,
  },
  formatPaperTradePolicyLabel,
  getPaperTradeSettings,
  normalizePaperTradeSettings,
});

async function getStoredPaperTradeSettings() {
  return readPaperTradeSettingsFromDrizzle({ repositories: RADAR_REPOSITORIES });
}

async function getPaperTradeSettingsLockState() {
  return readPaperTradeSettingsLockStateFromDrizzle({ repositories: RADAR_REPOSITORIES });
}

async function updateStoredPaperTradeSettings(settings, options = {}) {
  return savePaperTradeSettingsToDrizzle(settings, {
    repositories: RADAR_REPOSITORIES,
    applyToOpenPositions: Boolean(options.applyToOpenPositions),
  });
}

async function manuallyCloseStoredPaperPositions(input = {}) {
  return manuallyClosePaperPositions(null, input, {
    repositories: RADAR_REPOSITORIES,
    settings: await getStoredPaperTradeSettings(),
  });
}

const { processTradePlans } = createTradePlanProcessor({
  evaluateTradeIntent,
  getOpenPaperPosition,
  getOpenPaperPositionCount,
  getOpenPaperPositionCountInMemory,
  getOpenPaperPositionInMemory,
  getPaperAccountSummary: getPaperAccountSummaryForStorage,
  getPaperAccountSummaryFromPositions,
  getPaperEntrySizing,
  getStoredPaperTradeSettings,
  getRecentTradeScores: getRecentTradeScoresForStorage,
  getTradeScoreHistoryFromAlert,
  openPaperPosition,
  openPaperPositionInMemory,
  paperMaxCapitalUsagePct: PAPER_MAX_CAPITAL_USAGE_PCT,
  paperMaxOpenPositions: PAPER_MAX_OPEN_POSITIONS,
  paperTotalCapitalUsd: PAPER_TOTAL_CAPITAL_USD,
  recordTradeIntent: recordTradeIntentForStorage,
  scaleIntoPaperPosition,
  scaleIntoPaperPositionInMemory,
  updatePaperPositions,
  updatePaperPositionsInMemory,
});

const { scanNarratives } = createScanOrchestratorService({
  buildDashboardRows,
  buildDrizzleLocalResult,
  checkNarrativeNovelty,
  classifyNarrative,
  compareSignalPriority,
  ensureStorageReady: ensureRadarStorageReady,
  ensureStrategySessionMeta: ensureStrategySessionMetaForStorage,
  fetchNewTokens,
  isTokenSeen,
  log,
  maxAlertsPerRound: MAX_ALERTS_PER_ROUND,
  minLiquidity: MIN_LIQUIDITY,
  minMarketCap: MIN_MARKET_CAP,
  narrativesRuntime: NARRATIVES_RUNTIME,
  normalizeTheme,
  prepareRuntimeState: preparePersistedRuntimeState,
  flushRuntimeState: flushPersistedRuntimeState,
  recordToken,
  sleep,
  tgSend,
  trackMomentum,
});

function getOpenPositionMarkToMarketState(position, currentPriceOverride = null) {
  return getOpenPositionMarkToMarketStateBase(position, currentPriceOverride, {
    roundTo,
    mulBn,
    divBn,
    subBn,
    addBn,
  });
}

function getOpenPaperPositionInMemory(positions, chain, address) {
  return getOpenPaperPositionInMemoryBase(positions, chain, address);
}

function getOpenPaperPositionCountInMemory(positions) {
  return getOpenPaperPositionCountInMemoryBase(positions);
}

function getPaperAccountSummaryFromPositions(positions) {
  return getPaperAccountSummaryFromPositionsBase(positions, {
    totalCapitalUsd: PAPER_TOTAL_CAPITAL_USD,
    roundTo,
    sumBn,
    addBn,
    subBn,
    mulBn,
    divBn,
  });
}

const { runMain } = createScannerBootstrapService({
  ensureStrategySessionMeta: ensureStrategySessionMetaForStorage,
  formatPaperTradePolicyLabel,
  getStoredPaperTradeSettings,
  log,
  minSmartDegenCount: MIN_SMART_DEGEN_COUNT,
  paperBasePositionUsd: PAPER_BASE_POSITION_USD,
  paperMaxCapitalUsagePct: PAPER_MAX_CAPITAL_USAGE_PCT,
  paperMaxOpenPositions: PAPER_MAX_OPEN_POSITIONS,
  pushMinBuySellRatio: PUSH_MIN_BUY_SELL_RATIO,
  pushMinHolders: PUSH_MIN_HOLDERS,
  pushMinLiquidity: PUSH_MIN_LIQUIDITY,
  pushMinVolume: PUSH_MIN_VOLUME,
  requireSocials: REQUIRE_SOCIALS,
  scanInterval: SCAN_INTERVAL,
  scanNarratives,
  sleep,
  tgSend,
  tradeRules: TRADE_RULES,
  chains: SIGNAL_CHAINS.map((chain) => getSignalChainDefinition(chain).shortLabel),
});

const currentFilePath = fileURLToPath(import.meta.url);
const entryFilePath = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (currentFilePath === entryFilePath) {
  runMain().catch((error) => {
    log(`启动失败: ${error.message}`);
    process.exit(1);
  });
}

export {
  manuallyCloseStoredPaperPositions,
  getPaperTradeSettingsLockState,
  scanNarratives as scanSignals,
  getStoredPaperTradeSettings,
  getPersistedRadarSnapshot as getPersistedSignalSnapshot,
  getRealtimeRadarSnapshot as getRealtimeSignalSnapshot,
  getRadarConfig as getSignalScanConfig,
  updateStoredPaperTradeSettings,
};
