import { getPriceActionScore } from '../lib/signal-scores.js';

export function createScannerTradeService({
  addBn,
  divBn,
  evaluateTradeIntentWithRules,
  getBuySellMetrics,
  getTradeScoreWithRules,
  mulBn,
  paperTotalCapitalUsd,
  roundTo,
  rules,
  subBn,
  sumBn,
}) {
  function getTradeScore(alert) {
    return getTradeScoreWithRules(alert, {
      getBuySellMetrics,
      roundTo,
      rules,
    });
  }

  function evaluateTradeIntent(alert, options = {}) {
    return evaluateTradeIntentWithRules(alert, {
      ...options,
      getBuySellMetrics,
      roundTo,
      rules,
    });
  }

  function recordTradeIntent(db, alert, tradePlan, createdAt) {
    const rounds = Number(alert.rounds || alert.signalCount || 1);
    const priceScore = getPriceActionScore({
      ...alert,
      signalCount: rounds,
      buySellRatio: tradePlan.buySellRatio,
    }).score;

    db.prepare(`
      INSERT OR IGNORE INTO trade_intents (
        chain, address, signal_count, name, symbol, trade_score, price_score, rounds, status,
        decision_reason, smart_money, buy_sell_ratio, liquidity, volume,
        price, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      alert.token.chain,
      alert.token.address,
      alert.signalCount,
      alert.token.name,
      alert.token.symbol,
      tradePlan.tradeScore,
      priceScore,
      rounds,
      tradePlan.intentStatus,
      tradePlan.decisionReason,
      alert.token.sm || 0,
      tradePlan.buySellRatio,
      alert.token.liq || 0,
      alert.token.volume || 0,
      alert.token.price || 0,
      createdAt
    );
  }

  function getRecentTradeScores(db, chain, address, limit = rules.scoreAverageLookback - 1) {
    return db
      .prepare(
        `SELECT trade_score
         FROM trade_intents
         WHERE chain = ? AND address = ? AND trade_score IS NOT NULL
         ORDER BY created_at DESC, id DESC
         LIMIT ?`
      )
      .all(chain, address, limit)
      .reverse()
      .map((row) => Number(row.trade_score))
      .filter((score) => Number.isFinite(score));
  }

  function getPaperAccountSummary(db) {
    const rows = db
      .prepare(
        `SELECT position_size_usd, remaining_position_size_usd, remaining_token_amount,
                current_price, realized_pnl_usd, realized_proceeds_usd, status
         FROM paper_positions`
      )
      .all();

    const openRows = rows.filter((row) => row.status === 'open');
    const closedRows = rows.filter((row) => row.status === 'closed');
    const totalOpenedCostUsd = sumBn(rows.map((row) => row.position_size_usd || 0));
    const openBuyUsd = sumBn(
      openRows.map((row) => row.remaining_position_size_usd || row.position_size_usd || 0)
    );
    const openMarketValueUsd = sumBn(
      openRows.map((row) => mulBn(row.remaining_token_amount || 0, row.current_price || 0))
    );
    const openRealizedPnlUsd = sumBn(openRows.map((row) => row.realized_pnl_usd || 0));
    const openRealizedProceedsUsd = sumBn(openRows.map((row) => row.realized_proceeds_usd || 0));
    const openPnLUsd = addBn(openRealizedPnlUsd, subBn(openMarketValueUsd, openBuyUsd));

    const closedBuyUsd = sumBn(closedRows.map((row) => row.position_size_usd || 0));
    const closedSellUsd = sumBn(closedRows.map((row) => row.realized_proceeds_usd || 0));
    const closedPnLUsd = sumBn(closedRows.map((row) => row.realized_pnl_usd || 0));

    const cashBalanceUsd = addBn(
      subBn(paperTotalCapitalUsd, totalOpenedCostUsd),
      closedSellUsd,
      openRealizedProceedsUsd
    );
    const equityUsd = addBn(cashBalanceUsd, openMarketValueUsd);
    const totalPnLUsd = addBn(openPnLUsd, closedPnLUsd);
    const capitalUsagePct =
      paperTotalCapitalUsd > 0 ? roundTo(mulBn(divBn(openBuyUsd, paperTotalCapitalUsd), 100), 2) : 0;

    return {
      totalCapitalUsd: roundTo(paperTotalCapitalUsd, 2),
      cashBalanceUsd: roundTo(cashBalanceUsd, 2),
      availableUsd: roundTo(cashBalanceUsd, 2),
      usedCapitalUsd: roundTo(openBuyUsd, 2),
      equityUsd: roundTo(equityUsd, 2),
      capitalUsagePct: roundTo(capitalUsagePct, 2),
      openBuyUsd: roundTo(openBuyUsd, 2),
      openMarketValueUsd: roundTo(openMarketValueUsd, 2),
      openPnLUsd: roundTo(openPnLUsd, 2),
      closedBuyUsd: roundTo(closedBuyUsd, 2),
      closedSellUsd: roundTo(closedSellUsd, 2),
      closedPnLUsd: roundTo(closedPnLUsd, 2),
      totalPnLUsd: roundTo(totalPnLUsd, 2),
    };
  }

  return {
    evaluateTradeIntent,
    getPaperAccountSummary,
    getRecentTradeScores,
    getTradeScore,
    recordTradeIntent,
  };
}
