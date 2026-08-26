import { normalizeTakeProfitSteps } from '../lib/paper-trade-settings.js';

export function createPaperTradeSettingsService({
  defaultPaperStopLossPercent,
  defaultPaperTakeProfitSteps,
  defaultPaperTimeStopHours,
  defaultPaperTp1ProtectionPercent,
  defaultPaperFastFailureMinutes,
  defaultPaperFastFailureLossPercent,
  maxPaperStopLossPercent,
  legacyPaperTakeProfitPercent,
  roundTo,
  getRadarMeta,
  setRadarMeta,
}) {
  function normalizePaperTradeSettings(input = {}) {
    const fallback = {
      stopLossPercent: defaultPaperStopLossPercent,
      takeProfitSteps: defaultPaperTakeProfitSteps,
      timeStopHours: defaultPaperTimeStopHours,
      tp1ProtectionPercent: defaultPaperTp1ProtectionPercent,
      fastFailureMinutes: defaultPaperFastFailureMinutes,
      fastFailureLossPercent: defaultPaperFastFailureLossPercent,
    };

    const stopLossPercent = Number(input.stopLossPercent ?? fallback.stopLossPercent);
    const timeStopHours = Number(input.timeStopHours ?? fallback.timeStopHours);
    const tp1ProtectionPercent = Number(
      input.tp1ProtectionPercent ?? fallback.tp1ProtectionPercent
    );
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

  function formatTakeProfitStepsLabel(steps = []) {
    return steps.map((step) => `+${step.targetPercent}%/${step.sellPercent}%`).join(' · ');
  }

  function formatPaperTradePolicyLabel(settings = {}) {
    const normalized = normalizePaperTradeSettings(settings);
    return [
      `分批止盈 ${formatTakeProfitStepsLabel(normalized.takeProfitSteps)}`,
      `止损 -${normalized.stopLossPercent}%`,
      `TP1 后回落至 +${normalized.tp1ProtectionPercent}% 全平`,
      normalized.timeStopHours > 0 ? `${normalized.timeStopHours}h 未到 TP1 全平` : null,
      normalized.fastFailureMinutes > 0
        ? `${normalized.fastFailureMinutes}m 后跌至 -${normalized.fastFailureLossPercent}% 快速退出`
        : null,
    ].filter(Boolean).join(' | ');
  }

  function getPaperTradeSettings(db) {
    const raw = getRadarMeta(db, 'paper_trade_settings', null);
    if (!raw) {
      return normalizePaperTradeSettings();
    }

    try {
      return normalizePaperTradeSettings(JSON.parse(raw));
    } catch {
      return normalizePaperTradeSettings();
    }
  }

  function setPaperTradeSettings(db, settings) {
    const normalized = normalizePaperTradeSettings(settings);
    setRadarMeta(db, 'paper_trade_settings', JSON.stringify(normalized));
    return normalized;
  }

  function getPositionTakeProfitSteps(position, fallbackSettings = null) {
    if (position?.tp_plan_json) {
      try {
        return normalizeTakeProfitSteps(JSON.parse(position.tp_plan_json));
      } catch {
        // Ignore invalid persisted steps and fall back to current settings.
      }
    }

    return normalizeTakeProfitSteps(
      fallbackSettings?.takeProfitSteps || defaultPaperTakeProfitSteps
    );
  }

  function syncOpenPaperPositionSettings(db, settings) {
    const normalized = normalizePaperTradeSettings(settings);
    db.prepare(`
      UPDATE paper_positions
      SET stop_loss_pct = ?, take_profit_pct = ?, tp_plan_json = ?
      WHERE status = ?
    `).run(
      normalized.stopLossPercent,
      normalized.takeProfitSteps[0]?.targetPercent || legacyPaperTakeProfitPercent,
      JSON.stringify(normalized.takeProfitSteps),
      'open'
    );
  }

  return {
    formatPaperTradePolicyLabel,
    formatTakeProfitStepsLabel,
    getPaperTradeSettings,
    getPositionTakeProfitSteps,
    normalizePaperTradeSettings,
    setPaperTradeSettings,
    syncOpenPaperPositionSettings,
  };
}
