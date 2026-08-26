import {
  buildLegacyTakeProfitStepsFromEnv,
  normalizeTakeProfitSteps,
  parseTakeProfitStepsFromEnv,
} from '../lib/paper-trade-settings.js';
import { resolveSignalDbDriver } from '../../../shared/db/client/index.js';
import { ensurePostgresSchemaReady } from '../../../shared/db/client/postgres.js';
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
      80
    ),
    takeProfitSteps: normalizeTakeProfitSteps(
      parseTakeProfitStepsFromEnv(
        env.RADAR_PAPER_TP_STEPS || env.SIGNAL_PAPER_TP_STEPS
      ) || buildLegacyTakeProfitStepsFromEnv(env)
    ),
    timeStopHours: toNumber(
      env.RADAR_PAPER_TIME_STOP_HOURS || env.SIGNAL_PAPER_TIME_STOP_HOURS,
      0
    ),
    tp1ProtectionPercent: toNumber(
      env.SIGNAL_PAPER_TP1_PROTECTION_PERCENT || env.RADAR_PAPER_TP1_PROTECTION_PERCENT,
      5
    ),
    fastFailureMinutes: toNumber(
      env.SIGNAL_PAPER_FAST_FAILURE_MINUTES || env.RADAR_PAPER_FAST_FAILURE_MINUTES,
      0
    ),
    fastFailureLossPercent: toNumber(
      env.SIGNAL_PAPER_FAST_FAILURE_LOSS_PERCENT || env.RADAR_PAPER_FAST_FAILURE_LOSS_PERCENT,
      0
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
  const timeStopHours = Number(input.timeStopHours ?? fallback.timeStopHours);
  const tp1ProtectionPercent = Number(input.tp1ProtectionPercent ?? fallback.tp1ProtectionPercent);
  const fastFailureMinutes = Number(input.fastFailureMinutes ?? fallback.fastFailureMinutes);
  const fastFailureLossPercent = Number(
    input.fastFailureLossPercent ?? fallback.fastFailureLossPercent
  );

  return {
    stopLossPercent: Number.isFinite(stopLossPercent)
      ? Math.max(5, Math.min(maxPaperStopLossPercent, roundTo(stopLossPercent, 2)))
      : fallback.stopLossPercent,
    takeProfitSteps: normalizeTakeProfitSteps(input.takeProfitSteps || fallback.takeProfitSteps),
    timeStopHours: Number.isFinite(timeStopHours)
      ? Math.max(0, Math.min(168, roundTo(timeStopHours, 2)))
      : fallback.timeStopHours,
    tp1ProtectionPercent: Number.isFinite(tp1ProtectionPercent)
      ? Math.max(0, Math.min(50, roundTo(tp1ProtectionPercent, 2)))
      : fallback.tp1ProtectionPercent,
    fastFailureMinutes: Number.isFinite(fastFailureMinutes)
      ? Math.max(0, Math.min(240, roundTo(fastFailureMinutes, 0)))
      : fallback.fastFailureMinutes,
    fastFailureLossPercent: Number.isFinite(fastFailureLossPercent)
      ? Math.max(0, Math.min(50, roundTo(fastFailureLossPercent, 2)))
      : fallback.fastFailureLossPercent,
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
  await ensurePostgresSchemaReady(repos.drizzleClient);
  const raw = await repos.meta.getValue('paper_trade_settings', null);
  return parseStoredPaperTradeSettings(raw, env);
}

export async function readPaperTradeSettingsLockStateFromDrizzle(options = {}) {
  const repos = options.repositories || createRadarRepositories(options);
  await ensurePostgresSchemaReady(repos.drizzleClient);
  const openCount = Number(await repos.positions.countByStatus('open'));
  return {
    locked: openCount > 0,
    openCount,
  };
}

export async function savePaperTradeSettingsToDrizzle(payload = {}, options = {}) {
  const env = options.env || process.env;
  const repos = options.repositories || createRadarRepositories(options);
  await ensurePostgresSchemaReady(repos.drizzleClient);
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
