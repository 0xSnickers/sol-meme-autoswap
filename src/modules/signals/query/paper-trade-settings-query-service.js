import {
  buildLegacyTakeProfitStepsFromEnv,
  normalizeTakeProfitSteps,
  parseTakeProfitStepsFromEnv,
} from '../lib/paper-trade-settings.js';
import { resolveSignalDbDriver } from '../../../shared/db/client/index.js';
import { createRadarRepositories } from '../../../shared/db/repositories/index.js';

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function roundTo(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function getDefaultPaperTradeSettings(env = process.env) {
  return {
    stopLossPercent: toNumber(
      env.RADAR_PAPER_SL_PERCENT || env.SIGNAL_PAPER_SL_PERCENT,
      50
    ),
    takeProfitSteps: normalizeTakeProfitSteps(
      parseTakeProfitStepsFromEnv(
        env.RADAR_PAPER_TP_STEPS || env.SIGNAL_PAPER_TP_STEPS
      ) || buildLegacyTakeProfitStepsFromEnv(env)
    ),
    trailingStartPercent: toNumber(
      env.RADAR_PAPER_TRAILING_START_PERCENT || env.SIGNAL_PAPER_TRAILING_START_PERCENT,
      180
    ),
    trailingStopPercent: toNumber(
      env.RADAR_PAPER_TRAILING_STOP_PERCENT || env.SIGNAL_PAPER_TRAILING_STOP_PERCENT,
      35
    ),
    timeStopHours: toNumber(
      env.RADAR_PAPER_TIME_STOP_HOURS || env.SIGNAL_PAPER_TIME_STOP_HOURS,
      8
    ),
  };
}

function normalizePaperTradeSettings(input = {}, env = process.env) {
  const fallback = getDefaultPaperTradeSettings(env);
  const maxPaperStopLossPercent = toNumber(
    env.RADAR_PAPER_MAX_SL_PERCENT || env.SIGNAL_PAPER_MAX_SL_PERCENT,
    80
  );
  const stopLossPercent = Number(input.stopLossPercent ?? fallback.stopLossPercent);
  const trailingStartPercent = Number(
    input.trailingStartPercent ?? fallback.trailingStartPercent
  );
  const trailingStopPercent = Number(input.trailingStopPercent ?? fallback.trailingStopPercent);
  const timeStopHours = Number(input.timeStopHours ?? fallback.timeStopHours);

  return {
    stopLossPercent: Number.isFinite(stopLossPercent)
      ? Math.max(5, Math.min(maxPaperStopLossPercent, roundTo(stopLossPercent, 2)))
      : fallback.stopLossPercent,
    takeProfitSteps: normalizeTakeProfitSteps(input.takeProfitSteps || fallback.takeProfitSteps),
    trailingStartPercent: Number.isFinite(trailingStartPercent)
      ? Math.max(10, Math.min(300, roundTo(trailingStartPercent, 2)))
      : fallback.trailingStartPercent,
    trailingStopPercent: Number.isFinite(trailingStopPercent)
      ? Math.max(5, Math.min(80, roundTo(trailingStopPercent, 2)))
      : fallback.trailingStopPercent,
    timeStopHours: Number.isFinite(timeStopHours)
      ? Math.max(1, Math.min(168, roundTo(timeStopHours, 2)))
      : fallback.timeStopHours,
  };
}

function parseStoredPaperTradeSettings(raw, env = process.env) {
  if (!raw) {
    return normalizePaperTradeSettings({}, env);
  }

  try {
    return normalizePaperTradeSettings(JSON.parse(raw), env);
  } catch {
    return normalizePaperTradeSettings({}, env);
  }
}

export function canUseDrizzlePaperTradeSettingsQueries(env = process.env) {
  const driver = resolveSignalDbDriver(env);
  return driver === 'sqlite' || driver === 'postgres';
}

export async function readPaperTradeSettingsFromDrizzle(options = {}) {
  const env = options.env || process.env;
  const repos = options.repositories || createRadarRepositories(options);
  const raw = await repos.meta.getValue('paper_trade_settings', null);
  return parseStoredPaperTradeSettings(raw, env);
}

export async function readPaperTradeSettingsLockStateFromDrizzle(options = {}) {
  const repos = options.repositories || createRadarRepositories(options);
  const openCount = Number(await repos.positions.countByStatus('open'));
  return {
    locked: openCount > 0,
    openCount,
  };
}

export async function savePaperTradeSettingsToDrizzle(payload = {}, options = {}) {
  const env = options.env || process.env;
  const repos = options.repositories || createRadarRepositories(options);
  const normalized = normalizePaperTradeSettings(payload, env);

  await repos.meta.setValue('paper_trade_settings', JSON.stringify(normalized));

  if (options.applyToOpenPositions) {
    await repos.positions.syncOpenPaperTradeSettings(normalized, {
      legacyTakeProfitPercent: toNumber(
        env.RADAR_PAPER_TP_PERCENT || env.SIGNAL_PAPER_TP_PERCENT,
        50
      ),
    });
  }

  return normalized;
}
