export function createScannerConfigService({
  defaultScanConfig,
  formatPaperTradePolicyLabel,
  getPaperTradeSettings,
  normalizePaperTradeSettings,
}) {
  function getRadarConfig(db = null) {
    const paperTradeSettings = db ? getPaperTradeSettings(db) : normalizePaperTradeSettings();
    return {
      ...defaultScanConfig,
      paperTakeProfitPercent:
        paperTradeSettings.takeProfitSteps[0]?.targetPercent ||
        defaultScanConfig.paperTakeProfitPercent,
      paperTakeProfitSteps: paperTradeSettings.takeProfitSteps,
      paperStopLossPercent: paperTradeSettings.stopLossPercent,
      paperTrailingStartPercent: paperTradeSettings.trailingStartPercent,
      paperTrailingStopPercent: paperTradeSettings.trailingStopPercent,
      paperTimeStopHours: paperTradeSettings.timeStopHours,
      paperPolicyLabel: formatPaperTradePolicyLabel(paperTradeSettings),
      paperTradeSettings,
    };
  }

  return {
    getRadarConfig,
  };
}
