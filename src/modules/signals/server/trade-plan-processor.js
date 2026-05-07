export function createTradePlanProcessor({
  evaluateTradeIntent,
  getOpenPaperPosition,
  getOpenPaperPositionCount,
  getOpenPaperPositionCountInMemory,
  getOpenPaperPositionInMemory,
  getPaperAccountSummary,
  getPaperAccountSummaryFromPositions,
  getPaperEntrySizing,
  getStoredPaperTradeSettings,
  getRecentTradeScores,
  getTradeScoreHistoryFromAlert,
  openPaperPosition,
  openPaperPositionInMemory,
  paperMaxCapitalUsagePct,
  paperMaxOpenPositions,
  paperTotalCapitalUsd,
  recordTradeIntent,
  scaleIntoPaperPosition,
  scaleIntoPaperPositionInMemory,
  updatePaperPositions,
  updatePaperPositionsInMemory,
}) {
  function buildHistoryScoreMapFromAlerts(alerts = []) {
    const map = new Map();
    for (const alert of alerts) {
      if (!alert?.chain || !alert?.address) {
        continue;
      }
      const scores = getTradeScoreHistoryFromAlert(alert);
      if (scores.length > 0) {
        map.set(`${alert.chain}:${alert.address}`, scores);
      }
    }
    return map;
  }

  function processTradePlansInMemory(
    positions,
    alerts,
    tokens,
    createdAt,
    settings,
    historyScoreMap = new Map()
  ) {
    const nextPositions = updatePaperPositionsInMemory(positions, tokens, createdAt, settings);
    const candidates = alerts
      .map((alert) => {
        const historyScores = historyScoreMap.get(`${alert.token.chain}:${alert.token.address}`) || [];
        return { alert, tradePlan: evaluateTradeIntent(alert, { historyScores }) };
      })
      .sort(compareTradeCandidates);

    for (const { alert } of candidates) {
      const historyScores = historyScoreMap.get(`${alert.token.chain}:${alert.token.address}`) || [];
      const openPosition = getOpenPaperPositionInMemory(
        nextPositions,
        alert.token.chain,
        alert.token.address
      );
      const evaluatedPlan = evaluateTradeIntent(alert, { historyScores, openPosition });
      const sizing = getPaperEntrySizing(alert, evaluatedPlan, openPosition);

      if (evaluatedPlan.approved) {
        const account = getPaperAccountSummaryFromPositions(nextPositions);
        const nextUsedCapitalUsd = account.usedCapitalUsd + sizing.positionSizeUsd;
        const nextUsagePct =
          paperTotalCapitalUsd > 0 ? (nextUsedCapitalUsd / paperTotalCapitalUsd) * 100 : 0;

        if (!openPosition && getOpenPaperPositionCountInMemory(nextPositions) >= paperMaxOpenPositions) {
          rejectPlan(evaluatedPlan, `打开持仓数已达上限 ${paperMaxOpenPositions}`);
        } else if (sizing.positionSizeUsd <= 0) {
          rejectPlan(
            evaluatedPlan,
            openPosition ? '目标仓位已完成' : '头仓目标仓位无效',
            openPosition ? 'skipped' : 'rejected'
          );
        } else if (nextUsagePct > paperMaxCapitalUsagePct) {
          rejectPlan(
            evaluatedPlan,
            `资金使用率将达 ${nextUsagePct.toFixed(1)}%，超过上限 ${paperMaxCapitalUsagePct}%`
          );
        }
      }

      if (evaluatedPlan.approved) {
        const account = getPaperAccountSummaryFromPositions(nextPositions);
        if (sizing.positionSizeUsd > account.availableUsd) {
          rejectPlan(
            evaluatedPlan,
            `可用余额不足，需 ${sizing.positionSizeUsd.toFixed(2)} USD，剩余 ${account.availableUsd.toFixed(2)} USD`
          );
        }
      }

      if (evaluatedPlan.approved) {
        if (openPosition) {
          const nextPosition = scaleIntoPaperPositionInMemory(
            openPosition,
            alert,
            evaluatedPlan,
            createdAt,
            sizing
          );
          const index = nextPositions.findIndex((position) => position.id === openPosition.id);
          if (index >= 0) {
            nextPositions[index] = nextPosition;
          }
        } else {
          nextPositions.push(
            openPaperPositionInMemory(alert, evaluatedPlan, createdAt, sizing, settings)
          );
        }
      }

      alert.tradePlan = evaluatedPlan;
    }

    return nextPositions;
  }

  async function processTradePlans(db, alerts, tokens, createdAt, options = {}) {
    const settings = options.settings || (await getStoredPaperTradeSettings?.());
    await updatePaperPositions(db, tokens, createdAt, {
      ...options,
      settings,
    });

    const candidateItems = await Promise.all(
      alerts.map(async (alert) => {
        const historyScores = await getRecentTradeScores(
          db,
          alert.token.chain,
          alert.token.address,
          undefined,
          options
        );
        return { alert, tradePlan: evaluateTradeIntent(alert, { historyScores }) };
      })
    );
    const candidates = candidateItems.sort(compareTradeCandidates);

    for (const { alert } of candidates) {
      const openPosition = await getOpenPaperPosition(
        db,
        alert.token.chain,
        alert.token.address,
        options
      );
      const historyScores = await getRecentTradeScores(
        db,
        alert.token.chain,
        alert.token.address,
        undefined,
        options
      );
      const evaluatedPlan = evaluateTradeIntent(alert, { historyScores, openPosition });
      const sizing = getPaperEntrySizing(alert, evaluatedPlan, openPosition);

      if (evaluatedPlan.approved) {
        const account = await getPaperAccountSummary(db, options);
        const nextUsedCapitalUsd = account.usedCapitalUsd + sizing.positionSizeUsd;
        const nextUsagePct =
          paperTotalCapitalUsd > 0 ? (nextUsedCapitalUsd / paperTotalCapitalUsd) * 100 : 0;

        if (
          !openPosition &&
          (await getOpenPaperPositionCount(db, options)) >= paperMaxOpenPositions
        ) {
          rejectPlan(evaluatedPlan, `打开持仓数已达上限 ${paperMaxOpenPositions}`);
        } else if (sizing.positionSizeUsd <= 0) {
          rejectPlan(
            evaluatedPlan,
            openPosition ? '目标仓位已完成' : '头仓目标仓位无效',
            openPosition ? 'skipped' : 'rejected'
          );
        } else if (nextUsagePct > paperMaxCapitalUsagePct) {
          rejectPlan(
            evaluatedPlan,
            `资金使用率将达 ${nextUsagePct.toFixed(1)}%，超过上限 ${paperMaxCapitalUsagePct}%`
          );
        }
      }

      if (evaluatedPlan.approved) {
        const account = await getPaperAccountSummary(db, options);
        if (sizing.positionSizeUsd > account.availableUsd) {
          rejectPlan(
            evaluatedPlan,
            `可用余额不足，需 ${sizing.positionSizeUsd.toFixed(2)} USD，剩余 ${account.availableUsd.toFixed(2)} USD`
          );
        }
      }

      await recordTradeIntent(db, alert, evaluatedPlan, createdAt, options);

      if (evaluatedPlan.approved) {
        if (openPosition) {
          await scaleIntoPaperPosition(db, openPosition, alert, evaluatedPlan, createdAt, sizing, {
            ...options,
            settings,
          });
        } else {
          await openPaperPosition(db, alert, evaluatedPlan, createdAt, sizing, {
            ...options,
            settings,
          });
        }
      }

      alert.tradePlan = evaluatedPlan;
    }
  }

  function compareTradeCandidates(left, right) {
    if ((right.tradePlan.tradeScore || 0) !== (left.tradePlan.tradeScore || 0)) {
      return (right.tradePlan.tradeScore || 0) - (left.tradePlan.tradeScore || 0);
    }
    if ((right.alert.token.sm || 0) !== (left.alert.token.sm || 0)) {
      return (right.alert.token.sm || 0) - (left.alert.token.sm || 0);
    }
    return (right.alert.pctGain || 0) - (left.alert.pctGain || 0);
  }

  function rejectPlan(plan, reason, status = 'rejected') {
    plan.approved = false;
    plan.intentStatus = status;
    plan.decisionReason = reason;
  }

  return {
    buildHistoryScoreMapFromAlerts,
    processTradePlans,
    processTradePlansInMemory,
  };
}
