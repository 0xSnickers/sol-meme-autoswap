export function createRadarSnapshotService({
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
  getRadarConfig,
  getStrategyRuntimeInfoFromStartedAt,
  getTradeScoreHistoryFromAlert,
  legacyPaperTakeProfitPercent,
  minSmartDegenCount,
  momentumConsecutiveUp,
  momentumPushed,
  mulBn,
  normalizePaperTradeSettings,
  paperEntryStageAllocations,
  roundTo,
  subBn,
  sumBn,
}) {
  function getPaperTradeSummary(db) {
    const openCount = db
      .prepare('SELECT COUNT(*) AS count FROM paper_positions WHERE status = ?')
      .get('open').count;
    const closed = db
      .prepare('SELECT COUNT(*) AS count FROM paper_positions WHERE status = ?')
      .get('closed').count;
    const wins = db
      .prepare('SELECT COUNT(*) AS count FROM paper_positions WHERE status = ? AND pnl_pct > 0')
      .get('closed').count;
    const account = getPaperAccountSummary(db);

    return {
      openCount: openCount || 0,
      closedCount: closed || 0,
      winCount: wins || 0,
      winRate: closed > 0 ? Number(((wins / closed) * 100).toFixed(1)) : 0,
      openValueUsd: account.openMarketValueUsd,
      openCostUsd: account.openBuyUsd,
      openPnLUsd: account.openPnLUsd,
      closedCostUsd: account.closedBuyUsd,
      closedValueUsd: account.closedSellUsd,
      closedPnLUsd: account.closedPnLUsd,
      totalCapitalUsd: account.totalCapitalUsd,
      cashBalanceUsd: account.cashBalanceUsd,
      availableUsd: account.availableUsd,
      usedCapitalUsd: account.usedCapitalUsd,
      equityUsd: account.equityUsd,
      capitalUsagePct: account.capitalUsagePct,
      totalPnLUsd: account.totalPnLUsd,
    };
  }

  function getPaperPositions(db, status = 'open', limit = 20) {
    const rows = db
      .prepare(
        `SELECT
           paper_positions.*,
           (
             SELECT pushed_alerts.twitter
             FROM pushed_alerts
             WHERE pushed_alerts.chain = paper_positions.chain
               AND pushed_alerts.address = paper_positions.address
               AND pushed_alerts.twitter IS NOT NULL
               AND pushed_alerts.twitter != ''
             ORDER BY pushed_alerts.pushed_at DESC, pushed_alerts.id DESC
             LIMIT 1
           ) AS twitter
         FROM paper_positions
         WHERE status = ?
         ORDER BY updated_at DESC, opened_at DESC
         LIMIT ?`
      )
      .all(status, limit);

    const paperTradeSettings = getPaperTradeSettings(db);

    return rows.map((row) => {
      const takeProfitSteps = getPositionTakeProfitSteps(row, paperTradeSettings);
      const remainingTokenAmount = Number(row.remaining_token_amount || row.token_amount || 0);
      const remainingPositionSizeUsd = Number(
        row.remaining_position_size_usd || row.position_size_usd || 0
      );
      const currentValueUsd = roundTo(mulBn(remainingTokenAmount, Number(row.current_price || 0)), 2);
      const realizedPnlUsd = Number(row.realized_pnl_usd || 0);
      const pnlUsd = roundTo(
        addBn(realizedPnlUsd, subBn(currentValueUsd, remainingPositionSizeUsd)),
        2
      );

      return {
        id: row.id,
        chain: row.chain,
        address: row.address,
        name: row.name,
        symbol: row.symbol,
        imageUrl: row.image_url || '',
        entrySignalCount: row.entry_signal_count,
        tradeScore: row.trade_score,
        positionSizeUsd: Number(row.position_size_usd || 0),
        targetPositionSizeUsd: Number(row.target_position_size_usd || row.position_size_usd || 0),
        tokenAmount: Number(row.token_amount || 0),
        remainingTokenAmount,
        remainingPositionSizeUsd,
        entryPrice: row.entry_price,
        currentPrice: row.current_price,
        peakPrice: Number(row.peak_price || row.current_price || row.entry_price || 0),
        peakPnlPct: Number(row.peak_pnl_pct || 0),
        currentValueUsd,
        pnlPct: row.pnl_pct,
        pnlUsd,
        takeProfitPct: row.take_profit_pct,
        takeProfitSteps,
        stopLossPct: row.stop_loss_pct,
        status: row.status,
        smartMoney: row.smart_money,
        buySellRatio: row.buy_sell_ratio,
        liquidity: row.liquidity,
        volume: row.volume,
        realizedPnlUsd,
        realizedProceedsUsd: Number(row.realized_proceeds_usd || 0),
        tpStage: Number(row.tp_stage || 0),
        entryStage: Number(row.entry_stage || paperEntryStageAllocations.length),
        openedAt: row.opened_at ? new Date(row.opened_at * 1000).toISOString() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at * 1000).toISOString() : null,
        closedAt: row.closed_at ? new Date(row.closed_at * 1000).toISOString() : null,
        closePrice: row.close_price,
        closeReason: row.close_reason || '',
        twitter: row.twitter || '',
      };
    });
  }

  function enrichAlertsWithTradeState(db, alerts) {
    const intentStmt = db.prepare(`
      SELECT trade_score, status, decision_reason, created_at
      FROM trade_intents
      WHERE chain = ? AND address = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `);
    const positionStmt = db.prepare(`
      SELECT *
      FROM paper_positions
      WHERE chain = ? AND address = ?
      ORDER BY CASE WHEN status = 'open' THEN 0 ELSE 1 END, updated_at DESC, id DESC
      LIMIT 1
    `);
    const paperTradeSettings = getPaperTradeSettings(db);

    return alerts.map((alert) => {
      const intent = intentStmt.get(alert.chain, alert.address);
      const position = positionStmt.get(alert.chain, alert.address);
      const previewPlan = evaluateTradeIntent(alert, {
        historyScores: getTradeScoreHistoryFromAlert(alert),
        openPosition: position?.status === 'open' ? position : null,
      });
      const takeProfitSteps = position
        ? getPositionTakeProfitSteps(position, paperTradeSettings)
        : paperTradeSettings.takeProfitSteps;

      return {
        ...alert,
        tradeScore: intent?.trade_score ?? previewPlan.tradeScore,
        tradeDecisionStatus: intent?.status || previewPlan.intentStatus,
        tradeDecisionReason: intent?.decision_reason || previewPlan.decisionReason,
        tradeDecisionAt: intent?.created_at ? new Date(intent.created_at * 1000).toISOString() : null,
        paperPositionStatus: position?.status || '',
        paperPositionSizeUsd: position?.position_size_usd ?? null,
        paperTargetPositionSizeUsd:
          position?.target_position_size_usd ?? position?.position_size_usd ?? null,
        paperTokenAmount: position?.token_amount ?? null,
        paperEntryPrice: position?.entry_price ?? null,
        paperCurrentPrice: position?.current_price ?? null,
        paperPnLPct: position?.pnl_pct ?? null,
        paperRealizedPnLUsd: position?.realized_pnl_usd ?? 0,
        paperOpenedAt: position?.opened_at ? new Date(position.opened_at * 1000).toISOString() : null,
        paperClosedAt: position?.closed_at ? new Date(position.closed_at * 1000).toISOString() : null,
        paperCloseReason: position?.close_reason || '',
        paperTakeProfitPct:
          position?.take_profit_pct ??
          takeProfitSteps[0]?.targetPercent ??
          legacyPaperTakeProfitPercent,
        paperTakeProfitSteps: takeProfitSteps,
        paperTpStage: position?.tp_stage ?? 0,
        paperStopLossPct: position?.stop_loss_pct ?? paperTradeSettings.stopLossPercent,
        paperEntryStage: position?.entry_stage ?? paperEntryStageAllocations.length,
      };
    });
  }

  function getRecentPersistedAlerts(db, limit = 50) {
    const fetchLimit = Math.min(Math.max(limit * 20, 200), 2_000);
    const rows = db.prepare(`
      SELECT
        alerts.chain,
        alerts.address,
        alerts.signal_count,
        alerts.name,
        alerts.symbol,
        alerts.image_url,
        alerts.price,
        alerts.mc,
        alerts.liq,
        alerts.volume,
        alerts.smart_money,
        alerts.holders,
        alerts.buy_sell_ratio,
        alerts.age_hours,
        alerts.change_1h,
        alerts.pct_gain,
        alerts.stars,
        alerts.narrative_tag,
        alerts.category,
        alerts.twitter,
        alerts.telegram,
        alerts.website,
        alerts.message,
        alerts.pushed_at,
        intents.trade_score
      FROM pushed_alerts AS alerts
      LEFT JOIN trade_intents AS intents
        ON intents.chain = alerts.chain
       AND intents.address = alerts.address
       AND intents.signal_count = alerts.signal_count
      ORDER BY alerts.pushed_at DESC, alerts.id DESC
      LIMIT ?
    `).all(fetchLimit);

    const groups = new Map();
    let latestSignal = null;

    for (const row of rows) {
      const key = `${row.chain}:${row.address}`;
      const pushedAt = new Date(row.pushed_at * 1000).toISOString();
      const historyItem = {
        signalCount: row.signal_count,
        pushedAt,
        pctGain: row.pct_gain,
        price: row.price,
        tradeScore: row.trade_score,
      };

      if (!latestSignal) {
        latestSignal = {
          chain: row.chain,
          address: row.address,
          signalCount: row.signal_count,
          name: row.name,
          symbol: row.symbol,
          imageUrl: row.image_url || '',
          price: row.price,
          pushedAt,
          pctGain: row.pct_gain,
          smartMoney: row.smart_money,
          tradeScore: row.trade_score,
          narrativeTag: row.narrative_tag,
          category: row.category,
          twitter: row.twitter || '',
          telegram: row.telegram || '',
          website: row.website || '',
        };
      }

      if (!groups.has(key)) {
        if (groups.size >= limit) {
          continue;
        }

        groups.set(key, {
          address: row.address,
          name: row.name,
          symbol: row.symbol,
          imageUrl: row.image_url || '',
          chain: row.chain,
          price: row.price,
          mc: row.mc,
          liq: row.liq,
          volume: row.volume,
          smartMoney: row.smart_money,
          holders: row.holders,
          buySellRatio: row.buy_sell_ratio,
          ageHours: row.age_hours,
          change1h: row.change_1h,
          pctGain: row.pct_gain,
          stars: row.stars,
          narrativeTag: row.narrative_tag,
          category: row.category,
          signalCount: row.signal_count,
          occurrenceCount: 1,
          twitter: row.twitter || '',
          telegram: row.telegram || '',
          website: row.website || '',
          message: row.message,
          pushedAt,
          firstPushedAt: pushedAt,
          latestPushedAt: pushedAt,
          signalHistory: [historyItem],
        });
        continue;
      }

      const group = groups.get(key);
      group.occurrenceCount += 1;
      group.firstPushedAt = pushedAt;
      group.signalHistory.push(historyItem);
    }

    const groupedAlerts = [...groups.values()].sort((a, b) => {
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

    return {
      alerts: enrichAlertsWithTradeState(db, groupedAlerts),
      latestSignal,
    };
  }

  function getSignalTimeline(db, maxPoints = 1500) {
    const safeLimit = Number.isFinite(maxPoints)
      ? Math.min(Math.max(maxPoints, 100), 5_000)
      : 1500;
    const rows = db.prepare(`
      SELECT name, symbol, address, image_url, price, signal_count, pushed_at
      FROM pushed_alerts
      ORDER BY pushed_at ASC, id ASC
      LIMIT ?
    `).all(safeLimit);

    return rows.map((row, index) => ({
      time: new Date(row.pushed_at * 1000).toISOString(),
      signalCount: row.signal_count,
      cumulativeCount: index + 1,
      name: row.name,
      symbol: row.symbol,
      imageUrl: row.image_url || '',
      address: row.address,
      price: row.price,
    }));
  }

  function createEmptyRadarSnapshot(limit = 60, options = {}) {
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 120) : 60;
    const strategyRuntimeInfo = getStrategyRuntimeInfoFromStartedAt(options.strategyStartedAt || null);
    const paperTradeSettings = normalizePaperTradeSettings(
      options.paperTradeSettings || getRadarConfig().paperTradeSettings
    );

    return {
      pushed: 0,
      found: 0,
      scanned: 0,
      scannedAt: options.scannedAt || null,
      persistedThisRound: 0,
      totalPersisted: 0,
      totalPersistedTokens: 0,
      latestSignal: null,
      paperSummary: getPaperAccountSummaryFromPositions([]),
      paperPositions: [],
      closedPaperPositions: [],
      summary: {
        triggered: 0,
        ready: 0,
        watching: 0,
        scanning: 0,
      },
      alerts: [],
      signalTimeline: [],
      rows: [],
      config: {
        ...getRadarConfig(),
        paperTakeProfitPercent:
          paperTradeSettings.takeProfitSteps[0]?.targetPercent || legacyPaperTakeProfitPercent,
        paperTakeProfitSteps: paperTradeSettings.takeProfitSteps,
        paperStopLossPercent: paperTradeSettings.stopLossPercent,
        paperTradeSettings,
      },
      rowLimit: safeLimit,
      ...strategyRuntimeInfo,
    };
  }

  function buildDashboardRows(tokens, alerts) {
    const alertMap = new Map(alerts.map((alert) => [alert.token.address, alert]));

    return tokens
      .map((token) => {
        const [category, matchedKeywords] = classifyNarrative(token.name, token.symbol, token.chain);
        const { stars, narrativeTag } = classifyStars(token, category, matchedKeywords || [], {});
        const momentum = getMomentumState(token);
        const quality = getPushQualityResult(token, {});
        const signal = alertMap.get(token.address);
        const reasons = [];

        if (momentum.rounds < momentumConsecutiveUp) {
          reasons.push(`动量轮次不足 ${momentumConsecutiveUp}`);
        } else if (!momentum.consecutiveUp) {
          reasons.push('近3轮未连续上涨');
        }

        if (momentum.pctGain < 5) {
          reasons.push('总涨幅低于 5%');
        }

        if ((token.sm || 0) < minSmartDegenCount) {
          reasons.push(`聪明钱低于 ${minSmartDegenCount}`);
        }

        reasons.push(...quality.reasons);

        return {
          address: token.address,
          chain: token.chain,
          name: token.name,
          symbol: token.symbol,
          mc: token.mc,
          liq: token.liq,
          volume: token.volume,
          holders: token.holders,
          smartMoney: token.sm,
          buys1h: token.buys_1h || 0,
          sells1h: token.sells_1h || 0,
          buySellRatio: Number(quality.buySellRatio.toFixed(2)),
          price: token.price,
          ageHours: Number(token.age_h.toFixed(1)),
          change1h: token.chg_1h,
          change24h: token.chg_24h,
          twitter: token.twitter,
          telegram: token.telegram,
          website: token.website,
          stars,
          narrativeTag,
          category,
          matchedKeywords: matchedKeywords || [],
          momentumRounds: momentum.rounds,
          momentumGain: Number(momentum.pctGain.toFixed(2)),
          momentumUp: momentum.consecutiveUp,
          volumeIncreasing: momentum.volIncreasing,
          qualityPass: quality.pass,
          hasSocials: quality.hasSocials,
          signalTriggered: Boolean(signal),
          signalCount: signal ? momentumPushed.get(token.address)?.count || 1 : 0,
          reasons,
          status: signal
            ? 'triggered'
            : reasons.length === 0
              ? 'ready'
              : momentum.rounds >= 2
                ? 'watching'
                : 'scanning',
        };
      })
      .sort((a, b) => {
        const priority = { triggered: 3, ready: 2, watching: 1, scanning: 0 };
        return (
          priority[b.status] - priority[a.status] ||
          b.momentumGain - a.momentumGain ||
          b.volume - a.volume
        );
      });
  }

  return {
    buildDashboardRows,
    createEmptyRadarSnapshot,
    enrichAlertsWithTradeState,
    getPaperPositions,
    getPaperTradeSummary,
    getRecentPersistedAlerts,
    getSignalTimeline,
  };
}
