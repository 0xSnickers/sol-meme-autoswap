import { normalizeTakeProfitSteps } from '../lib/paper-trade-settings.js';
import { createPaperPositionEngine } from './paper-position-engine.js';
import { createPaperPositionSizer } from './paper-position-sizer.js';

export function createPaperPositionLifecycleService({
  addBn,
  divBn,
  getOpenPositionMarkToMarketState,
  getPaperTradeSettings,
  getPositionEntryStage,
  getPositionTakeProfitSteps,
  getPositionTargetPositionSizeUsd,
  legacyPaperTakeProfitPercent,
  mulBn,
  normalizePaperTradeSettings,
  paperBasePositionUsd,
  paperEntryStageAllocations,
  paperMaxSinglePositionPct,
  paperTotalCapitalUsd,
  roundTo,
  subBn,
  fetchTrackedLivePrices = null,
}) {
  const {
    getPaperEntrySizing,
    getPaperPositionSizing,
    getPaperPositionSizingByMetrics,
    getPaperTargetPositionSizing,
  } = createPaperPositionSizer({
    addBn,
    divBn,
    getPositionEntryStage,
    getPositionTargetPositionSizeUsd,
    mulBn,
    paperBasePositionUsd,
    paperEntryStageAllocations,
    paperMaxSinglePositionPct,
    paperTotalCapitalUsd,
    roundTo,
    subBn,
  });

  const { calculateNextPositionState } = createPaperPositionEngine({
    addBn,
    divBn,
    getOpenPositionMarkToMarketState,
    mulBn,
    normalizePaperTradeSettings,
    roundTo,
    subBn,
  });

  async function getOpenPaperPosition(db, chain, address, options = {}) {
    const repos = options.repositories;
    if (repos) {
      return repos.positions.findOpenPosition(chain, address);
    }

    return db
      .prepare(
        `SELECT *
         FROM paper_positions
         WHERE chain = ? AND address = ? AND status = ?
         ORDER BY opened_at DESC, id DESC
         LIMIT 1`
      )
      .get(chain, address, 'open');
  }

  async function getOpenPaperPositionCount(db, options = {}) {
    const repos = options.repositories;
    if (repos) {
      return repos.positions.countByStatus('open');
    }

    return (
      db.prepare('SELECT COUNT(*) AS count FROM paper_positions WHERE status = ?').get('open')
        .count || 0
    );
  }

  async function openPaperPosition(db, alert, tradePlan, createdAt, sizing, options = {}) {
    const repos = options.repositories;
    const settings = options.settings || getPaperTradeSettings(db);
    const finalSizing = sizing || getPaperEntrySizing(alert, tradePlan);
    const takeProfitSteps = normalizeTakeProfitSteps(settings.takeProfitSteps);
    const entryPrice = Number(alert.token.price || 0);

    if (repos) {
      await repos.positions.insertMany([
        {
          chain: alert.token.chain,
          address: alert.token.address,
          name: alert.token.name,
          symbol: alert.token.symbol,
          imageUrl: alert.token.imageUrl || '',
          entrySignalCount: alert.signalCount,
          tradeScore: tradePlan.tradeScore,
          positionSizeUsd: finalSizing.positionSizeUsd,
          targetPositionSizeUsd: finalSizing.targetPositionSizeUsd,
          tokenAmount: finalSizing.tokenAmount,
          remainingTokenAmount: finalSizing.tokenAmount,
          remainingPositionSizeUsd: finalSizing.positionSizeUsd,
          realizedPnlUsd: 0,
          realizedProceedsUsd: 0,
          tpStage: 0,
          tpPlanJson: JSON.stringify(takeProfitSteps),
          entryPrice,
          currentPrice: entryPrice,
          takeProfitPct: takeProfitSteps[0]?.targetPercent || legacyPaperTakeProfitPercent,
          stopLossPct: settings.stopLossPercent,
          status: 'open',
          openedAt: createdAt,
          updatedAt: createdAt,
          smartMoney: alert.token.sm || 0,
          buySellRatio: tradePlan.buySellRatio,
          liquidity: alert.token.liq || 0,
          volume: alert.token.volume || 0,
          entryStage: finalSizing.nextEntryStage,
          peakPrice: entryPrice,
          peakPnlPct: 0,
        },
      ]);
      return;
    }

    db.prepare(`
      INSERT OR IGNORE INTO paper_positions (
        chain, address, name, symbol, image_url, entry_signal_count, trade_score, position_size_usd,
        target_position_size_usd,
        token_amount, remaining_token_amount, remaining_position_size_usd,
        realized_pnl_usd, realized_proceeds_usd, tp_stage, tp_plan_json,
        entry_price, current_price, take_profit_pct, stop_loss_pct, status,
        opened_at, updated_at, smart_money, buy_sell_ratio, liquidity, volume, entry_stage,
        peak_price, peak_pnl_pct
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      alert.token.chain,
      alert.token.address,
      alert.token.name,
      alert.token.symbol,
      alert.token.imageUrl || '',
      alert.signalCount,
      tradePlan.tradeScore,
      finalSizing.positionSizeUsd,
      finalSizing.targetPositionSizeUsd,
      finalSizing.tokenAmount,
      finalSizing.tokenAmount,
      finalSizing.positionSizeUsd,
      0,
      0,
      0,
      JSON.stringify(takeProfitSteps),
      entryPrice,
      entryPrice,
      takeProfitSteps[0]?.targetPercent || legacyPaperTakeProfitPercent,
      settings.stopLossPercent,
      'open',
      createdAt,
      createdAt,
      alert.token.sm || 0,
      tradePlan.buySellRatio,
      alert.token.liq || 0,
      alert.token.volume || 0,
      finalSizing.nextEntryStage,
      entryPrice,
      0
    );
  }

  async function scaleIntoPaperPosition(db, position, alert, tradePlan, createdAt, sizing, options = {}) {
    const addPositionUsd = Number(sizing?.positionSizeUsd || 0);
    const addTokenAmount = Number(sizing?.tokenAmount || 0);
    if (addPositionUsd <= 0 || addTokenAmount <= 0) {
      return;
    }

    const repos = options.repositories;
    const currentPrice = Number(alert.token.price || 0);
    const currentPositionSizeUsd = Number(position.position_size_usd ?? position.positionSizeUsd ?? 0);
    const currentTokenAmount = Number(position.token_amount ?? position.tokenAmount ?? 0);
    const currentRemainingPositionUsd = Number(
      position.remaining_position_size_usd ??
        position.remainingPositionSizeUsd ??
        currentPositionSizeUsd ??
        0
    );
    const currentRemainingTokenAmount = Number(
      position.remaining_token_amount ??
        position.remainingTokenAmount ??
        currentTokenAmount ??
        0
    );
    const nextPositionSizeUsd = roundTo(addBn(currentPositionSizeUsd, addPositionUsd), 6);
    const nextTokenAmount = roundTo(addBn(currentTokenAmount, addTokenAmount), 6);
    const nextRemainingPositionUsd = roundTo(addBn(currentRemainingPositionUsd, addPositionUsd), 6);
    const nextRemainingTokenAmount = roundTo(
      addBn(currentRemainingTokenAmount, addTokenAmount),
      6
    );
    const nextEntryPrice =
      nextTokenAmount > 0 ? roundTo(divBn(nextPositionSizeUsd, nextTokenAmount), 8) : currentPrice;
    const peakPrice = Math.max(
      Number(position.peak_price ?? position.peakPrice ?? 0),
      currentPrice,
      nextEntryPrice
    );
    const peakPnlPct =
      nextPositionSizeUsd > 0
        ? roundTo(
            mulBn(
              divBn(
                subBn(mulBn(peakPrice, nextTokenAmount), nextPositionSizeUsd),
                nextPositionSizeUsd
              ),
              100
            ),
            2
          )
        : 0;

    if (repos) {
      await repos.positions.updateById(position.id, {
        tradeScore: tradePlan.tradeScore,
        positionSizeUsd: nextPositionSizeUsd,
        targetPositionSizeUsd: sizing.targetPositionSizeUsd,
        tokenAmount: nextTokenAmount,
        remainingTokenAmount: nextRemainingTokenAmount,
        remainingPositionSizeUsd: nextRemainingPositionUsd,
        entryPrice: nextEntryPrice,
        currentPrice,
        updatedAt: createdAt,
        smartMoney: alert.token.sm || 0,
        buySellRatio: tradePlan.buySellRatio,
        liquidity: alert.token.liq || 0,
        volume: alert.token.volume || 0,
        entryStage: sizing.nextEntryStage,
        peakPrice,
        peakPnlPct,
      });
      return;
    }

    db.prepare(`
      UPDATE paper_positions
      SET trade_score = ?, position_size_usd = ?, target_position_size_usd = ?, token_amount = ?,
          remaining_token_amount = ?, remaining_position_size_usd = ?, entry_price = ?,
          current_price = ?, updated_at = ?, smart_money = ?, buy_sell_ratio = ?, liquidity = ?,
          volume = ?, entry_stage = ?, peak_price = ?, peak_pnl_pct = ?
      WHERE id = ?
    `).run(
      tradePlan.tradeScore,
      nextPositionSizeUsd,
      sizing.targetPositionSizeUsd,
      nextTokenAmount,
      nextRemainingTokenAmount,
      nextRemainingPositionUsd,
      nextEntryPrice,
      currentPrice,
      createdAt,
      alert.token.sm || 0,
      tradePlan.buySellRatio,
      alert.token.liq || 0,
      alert.token.volume || 0,
      sizing.nextEntryStage,
      peakPrice,
      peakPnlPct,
      position.id
    );
  }

  async function updatePaperPositions(db, tokens, updatedAt, options = {}) {
    const repos = options.repositories;
    const settings = options.settings || getPaperTradeSettings(db);
    const tokenMap = new Map(tokens.map((token) => [`${token.chain}:${token.address}`, token]));
    const openPositions = repos
      ? await repos.positions.listByStatus('open')
      : db.prepare('SELECT * FROM paper_positions WHERE status = ? ORDER BY opened_at DESC').all('open');

    let livePriceMap = new Map();
    if (fetchTrackedLivePrices) {
      const missingTrackedTokens = openPositions.filter(
        (position) => !tokenMap.has(`${position.chain}:${position.address}`)
      );
      if (missingTrackedTokens.length > 0) {
        const trackedTokens = missingTrackedTokens.map((p) => ({
          chain: p.chain,
          address: p.address,
        }));
        livePriceMap = await fetchTrackedLivePrices(trackedTokens);
      }
    }

    const updateStmt = repos
      ? null
      : db.prepare(`
      UPDATE paper_positions
      SET current_price = ?, pnl_pct = ?, updated_at = ?, remaining_token_amount = ?,
          remaining_position_size_usd = ?, realized_pnl_usd = ?, realized_proceeds_usd = ?,
          tp_stage = ?, tp_plan_json = ?, take_profit_pct = ?, stop_loss_pct = ?,
          peak_price = ?, peak_pnl_pct = ?
      WHERE id = ?
    `);
    const closeStmt = repos
      ? null
      : db.prepare(`
      UPDATE paper_positions
      SET status = ?, current_price = ?, close_price = ?, close_reason = ?,
          pnl_pct = ?, updated_at = ?, closed_at = ?, remaining_token_amount = ?,
          remaining_position_size_usd = ?, realized_pnl_usd = ?, realized_proceeds_usd = ?,
          tp_stage = ?, tp_plan_json = ?, take_profit_pct = ?, stop_loss_pct = ?,
          peak_price = ?, peak_pnl_pct = ?
      WHERE id = ?
    `);

    for (const position of openPositions) {
      const key = `${position.chain}:${position.address}`;
      let currentPrice = null;

      const tokenFromScan = tokenMap.get(key);
      if (tokenFromScan?.price) {
        currentPrice = Number(tokenFromScan.price);
      } else if (livePriceMap.has(key)) {
        currentPrice = Number(livePriceMap.get(key));
      }

      if (!currentPrice || !(position.entry_price ?? position.entryPrice)) {
        continue;
      }

      const nextState = calculateNextPositionState(
        {
          position,
          currentPrice,
          updatedAt,
          settings,
          takeProfitSteps: getPositionTakeProfitSteps(position, settings),
        },
        { mode: 'db' }
      );

      if (nextState.status === 'closed') {
        if (repos) {
          await repos.positions.updateById(position.id, {
            status: 'closed',
            currentPrice: nextState.currentPrice,
            closePrice: nextState.currentPrice,
            closeReason: nextState.closeReason,
            pnlPct: nextState.pnlPct,
            updatedAt,
            closedAt: updatedAt,
            remainingTokenAmount: 0,
            remainingPositionSizeUsd: 0,
            realizedPnlUsd: nextState.realizedPnlUsd,
            realizedProceedsUsd: nextState.realizedProceedsUsd,
            tpStage: nextState.tpStage,
            tpPlanJson: JSON.stringify(nextState.takeProfitSteps),
            takeProfitPct: nextState.takeProfitPct,
            stopLossPct: nextState.stopLossPct,
            peakPrice: nextState.peakPrice,
            peakPnlPct: nextState.peakPnlPct,
          });
          continue;
        }

        closeStmt.run(
          'closed',
          nextState.currentPrice,
          nextState.currentPrice,
          nextState.closeReason,
          nextState.pnlPct,
          updatedAt,
          updatedAt,
          0,
          0,
          nextState.realizedPnlUsd,
          nextState.realizedProceedsUsd,
          nextState.tpStage,
          JSON.stringify(nextState.takeProfitSteps),
          nextState.takeProfitPct,
          nextState.stopLossPct,
          nextState.peakPrice,
          nextState.peakPnlPct,
          position.id
        );
        continue;
      }

      if (repos) {
        await repos.positions.updateById(position.id, {
          currentPrice: nextState.currentPrice,
          pnlPct: nextState.pnlPct,
          updatedAt,
          remainingTokenAmount: nextState.remainingTokenAmount,
          remainingPositionSizeUsd: nextState.remainingPositionSizeUsd,
          realizedPnlUsd: nextState.realizedPnlUsd,
          realizedProceedsUsd: nextState.realizedProceedsUsd,
          tpStage: nextState.tpStage,
          tpPlanJson: JSON.stringify(nextState.takeProfitSteps),
          takeProfitPct: nextState.takeProfitPct,
          stopLossPct: nextState.stopLossPct,
          peakPrice: nextState.peakPrice,
          peakPnlPct: nextState.peakPnlPct,
        });
        continue;
      }

      updateStmt.run(
        nextState.currentPrice,
        nextState.pnlPct,
        updatedAt,
        nextState.remainingTokenAmount,
        nextState.remainingPositionSizeUsd,
        nextState.realizedPnlUsd,
        nextState.realizedProceedsUsd,
        nextState.tpStage,
        JSON.stringify(nextState.takeProfitSteps),
        nextState.takeProfitPct,
        nextState.stopLossPct,
        nextState.peakPrice,
        nextState.peakPnlPct,
        position.id
      );
    }
  }

  function openPaperPositionInMemory(alert, tradePlan, createdAt, sizing, settings) {
    const finalSizing = sizing || getPaperEntrySizing(alert, tradePlan);
    const takeProfitSteps = normalizeTakeProfitSteps(settings.takeProfitSteps);
    const openedAtIso = new Date(createdAt * 1000).toISOString();
    const entryPrice = Number(alert.token.price || 0);

    return {
      id: `${alert.token.chain}:${alert.token.address}:${alert.signalCount}`,
      chain: alert.token.chain,
      address: alert.token.address,
      name: alert.token.name,
      symbol: alert.token.symbol,
      imageUrl: alert.token.imageUrl || '',
      entrySignalCount: alert.signalCount,
      tradeScore: tradePlan.tradeScore,
      positionSizeUsd: finalSizing.positionSizeUsd,
      targetPositionSizeUsd: finalSizing.targetPositionSizeUsd,
      tokenAmount: finalSizing.tokenAmount,
      remainingTokenAmount: finalSizing.tokenAmount,
      remainingPositionSizeUsd: finalSizing.positionSizeUsd,
      realizedPnlUsd: 0,
      realizedProceedsUsd: 0,
      tpStage: 0,
      takeProfitSteps,
      entryPrice,
      currentPrice: entryPrice,
      peakPrice: entryPrice,
      peakPnlPct: 0,
      takeProfitPct: takeProfitSteps[0]?.targetPercent || legacyPaperTakeProfitPercent,
      stopLossPct: settings.stopLossPercent,
      status: 'open',
      openedAt: openedAtIso,
      updatedAt: openedAtIso,
      closedAt: null,
      closePrice: null,
      closeReason: '',
      pnlPct: 0,
      twitter: alert.descInfo?.twitter || alert.token.twitter || '',
      smartMoney: alert.token.sm || 0,
      buySellRatio: tradePlan.buySellRatio,
      liquidity: alert.token.liq || 0,
      volume: alert.token.volume || 0,
      entryStage: finalSizing.nextEntryStage,
      currentValueUsd: finalSizing.positionSizeUsd,
      pnlUsd: 0,
    };
  }

  function scaleIntoPaperPositionInMemory(position, alert, tradePlan, createdAt, sizing) {
    const addPositionUsd = Number(sizing?.positionSizeUsd || 0);
    const addTokenAmount = Number(sizing?.tokenAmount || 0);
    if (addPositionUsd <= 0 || addTokenAmount <= 0) {
      return position;
    }

    const currentPrice = Number(alert.token.price || 0);
    const currentPositionSizeUsd = Number(position.positionSizeUsd || 0);
    const currentTokenAmount = Number(position.tokenAmount || 0);
    const currentRemainingPositionUsd = Number(
      position.remainingPositionSizeUsd ?? currentPositionSizeUsd
    );
    const currentRemainingTokenAmount = Number(
      position.remainingTokenAmount ?? currentTokenAmount
    );
    const nextPositionSizeUsd = roundTo(addBn(currentPositionSizeUsd, addPositionUsd), 6);
    const nextTokenAmount = roundTo(addBn(currentTokenAmount, addTokenAmount), 6);
    const nextRemainingPositionUsd = roundTo(addBn(currentRemainingPositionUsd, addPositionUsd), 6);
    const nextRemainingTokenAmount = roundTo(
      addBn(currentRemainingTokenAmount, addTokenAmount),
      6
    );
    const nextEntryPrice =
      nextTokenAmount > 0 ? roundTo(divBn(nextPositionSizeUsd, nextTokenAmount), 8) : currentPrice;
    const peakPrice = Math.max(Number(position.peakPrice || 0), currentPrice, nextEntryPrice);
    const peakPnlPct =
      nextPositionSizeUsd > 0
        ? roundTo(
            mulBn(
              divBn(
                subBn(mulBn(peakPrice, nextTokenAmount), nextPositionSizeUsd),
                nextPositionSizeUsd
              ),
              100
            ),
            2
          )
        : 0;

    return {
      ...position,
      tradeScore: tradePlan.tradeScore,
      positionSizeUsd: nextPositionSizeUsd,
      targetPositionSizeUsd: sizing.targetPositionSizeUsd,
      tokenAmount: nextTokenAmount,
      remainingTokenAmount: nextRemainingTokenAmount,
      remainingPositionSizeUsd: nextRemainingPositionUsd,
      entryPrice: nextEntryPrice,
      currentPrice,
      updatedAt: new Date(createdAt * 1000).toISOString(),
      smartMoney: alert.token.sm || 0,
      buySellRatio: tradePlan.buySellRatio,
      liquidity: alert.token.liq || 0,
      volume: alert.token.volume || 0,
      entryStage: sizing.nextEntryStage,
      peakPrice: roundTo(peakPrice, 8),
      peakPnlPct,
      currentValueUsd: roundTo(mulBn(nextRemainingTokenAmount, currentPrice), 2),
      pnlUsd: roundTo(
        subBn(mulBn(nextRemainingTokenAmount, currentPrice), nextRemainingPositionUsd),
        2
      ),
    };
  }

  function updatePaperPositionsInMemory(positions, tokens, updatedAt, settings) {
    const tokenMap = new Map(tokens.map((token) => [`${token.chain}:${token.address}`, token]));
    const updatedAtIso = new Date(updatedAt * 1000).toISOString();

    return positions.map((position) => {
      if (position.status !== 'open') {
        return position;
      }

      const token = tokenMap.get(`${position.chain}:${position.address}`);
      if (!token || !token.price || !position.entryPrice) {
        return position;
      }

      const nextState = calculateNextPositionState(
        {
          position,
          currentPrice: Number(token.price || 0),
          updatedAt,
          settings,
          takeProfitSteps: normalizeTakeProfitSteps(
            position.takeProfitSteps || settings.takeProfitSteps
          ),
        },
        { mode: 'memory', updatedAtIso }
      );

      return {
        ...position,
        ...nextState,
      };
    });
  }

  return {
    getOpenPaperPosition,
    getOpenPaperPositionCount,
    getPaperEntrySizing,
    getPaperPositionSizing,
    getPaperPositionSizingByMetrics,
    getPaperTargetPositionSizing,
    openPaperPosition,
    openPaperPositionInMemory,
    scaleIntoPaperPosition,
    scaleIntoPaperPositionInMemory,
    updatePaperPositions,
    updatePaperPositionsInMemory,
  };
}
