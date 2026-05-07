import { normalizeTakeProfitSteps } from '../lib/paper-trade-settings.js';

export function createPaperTradeSettingsService({
  defaultPaperStopLossPercent,
  defaultPaperTakeProfitSteps,
  defaultPaperTrailingStartPercent,
  defaultPaperTrailingStopPercent,
  defaultPaperTimeStopHours,
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
      trailingStartPercent: defaultPaperTrailingStartPercent,
      trailingStopPercent: defaultPaperTrailingStopPercent,
      timeStopHours: defaultPaperTimeStopHours,
    };

    const stopLossPercent = Number(input.stopLossPercent ?? fallback.stopLossPercent);
    const trailingStartPercent = Number(
      input.trailingStartPercent ?? fallback.trailingStartPercent
    );
    const trailingStopPercent = Number(
      input.trailingStopPercent ?? fallback.trailingStopPercent
    );
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

  function formatTakeProfitStepsLabel(steps = []) {
    return steps.map((step) => `+${step.targetPercent}%/${step.sellPercent}%`).join(' · ');
  }

  function formatPaperTradePolicyLabel(settings = {}) {
    const normalized = normalizePaperTradeSettings(settings);
    return [
      `分批止盈 ${formatTakeProfitStepsLabel(normalized.takeProfitSteps)}`,
      `止损 -${normalized.stopLossPercent}%`,
      `${normalized.timeStopHours}h 未到 TP1 全平`,
      `+${normalized.trailingStartPercent}% 启动 trailing / 回撤 ${normalized.trailingStopPercent}%`,
    ].join(' | ');
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
