export function createScannerPersistenceService({
  createEmptyRadarSnapshot,
  getBuySellMetrics,
  getStoredPaperTradeSettings,
  readPersistedSignalSnapshot,
}) {
  function toAlertRecord(alert, pushedAt) {
    return {
      chain: alert.token.chain,
      address: alert.token.address,
      signalCount: alert.signalCount || 1,
      name: alert.token.name,
      symbol: alert.token.symbol,
      imageUrl: alert.token.imageUrl || '',
      price: alert.token.price || 0,
      mc: alert.token.mc,
      liq: alert.token.liq,
      volume: alert.token.volume,
      smartMoney: alert.token.sm || 0,
      holders: alert.token.holders || 0,
      buySellRatio: Number(getBuySellMetrics(alert.token).buySellRatio.toFixed(2)),
      ageHours: Number(alert.token.age_h.toFixed(1)),
      change1h: alert.token.chg_1h || 0,
      pctGain: Number(alert.pctGain.toFixed(2)),
      stars: alert.stars || 1,
      narrativeTag: alert.narrativeTag || '无明确叙事',
      category: alert.category || 'other',
      twitter: alert.descInfo?.twitter || alert.token.twitter || '',
      telegram: alert.descInfo?.telegram || alert.token.telegram || '',
      website: alert.descInfo?.website || alert.token.website || '',
      message: alert.msg,
      pushedAt,
      tradeScore: alert.tradePlan?.tradeScore ?? null,
      tradeStatus: alert.tradePlan?.intentStatus || null,
      tradeReason: alert.tradePlan?.decisionReason || null,
      tradeDecisionAt: alert.tradePlan ? pushedAt : null,
    };
  }

  async function persistAlerts(_db, alerts, pushedAt, options = {}) {
    if (!alerts.length) {
      return 0;
    }

    const repos = options.repositories;
    if (repos) {
      const rows = alerts.map((alert, index) => toAlertRecord(alert, pushedAt + index));
      const beforeCount = await repos.alerts.countAll();
      await repos.alerts.insertMany(rows);
      const afterCount = await repos.alerts.countAll();
      return Math.max(0, afterCount - beforeCount);
    }

    throw new Error('persistAlerts 旧 sqlite fallback 已移除，请传入 repositories');
  }

  async function getPersistedRadarSnapshot(limit = 60) {
    if (readPersistedSignalSnapshot) {
      return readPersistedSignalSnapshot(limit);
    }

    return createEmptyRadarSnapshot(limit, {
      paperTradeSettings: await getStoredPaperTradeSettings(),
    });
  }

  return {
    getPersistedRadarSnapshot,
    persistAlerts,
  };
}
