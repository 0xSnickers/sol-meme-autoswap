export function createPaperPositionEngine({
  addBn,
  divBn,
  getOpenPositionMarkToMarketState,
  mulBn,
  normalizePaperTradeSettings,
  getSellExecution,
  roundTo,
  subBn,
}) {
  function getOpenPositionMarkToMarket(position, currentPriceOverride = null) {
    const currentPrice = Number(currentPriceOverride ?? position.current_price ?? 0);
    const remainingTokenAmount = Number(
      position.remaining_token_amount ?? position.token_amount ?? 0
    );
    const remainingCostBasisUsd = Number(
      position.remaining_position_size_usd ?? position.position_size_usd ?? 0
    );
    const realizedPnlUsd = Number(position.realized_pnl_usd || 0);
    const currentValueUsd = roundTo(
      getSellExecution({
        chain: position.chain,
        quotedPrice: currentPrice,
        tokenAmount: remainingTokenAmount,
      }).netProceedsUsd,
      2
    );
    const pnlUsd = roundTo(
      addBn(realizedPnlUsd, subBn(currentValueUsd, remainingCostBasisUsd)),
      2
    );
    const totalCostUsd = Number(position.position_size_usd || 0);
    const pnlPct =
      totalCostUsd > 0 ? roundTo(mulBn(divBn(pnlUsd, totalCostUsd), 100), 2) : 0;

    return {
      currentPrice,
      remainingTokenAmount,
      remainingCostBasisUsd,
      realizedPnlUsd,
      currentValueUsd,
      pnlUsd,
      pnlPct,
    };
  }

  function getPositionOpenedAtTs(position) {
    if (Number.isFinite(Number(position?.opened_at))) {
      return Number(position.opened_at);
    }
    if (position?.openedAt) {
      const parsed = Date.parse(position.openedAt);
      if (Number.isFinite(parsed)) {
        return Math.floor(parsed / 1000);
      }
    }
    return 0;
  }

  function getPositionPeakPrice(position, currentPrice, entryPrice) {
    return Math.max(
      Number(position?.peak_price ?? position?.peakPrice ?? 0),
      Number(currentPrice || 0),
      Number(entryPrice || 0)
    );
  }

  function shouldCloseForTimeStop(position, currentPrice, updatedAtTs, takeProfitSteps, settings) {
    const normalized = normalizePaperTradeSettings(settings);
    const openedAtTs = getPositionOpenedAtTs(position);
    if (!openedAtTs || normalized.timeStopHours <= 0) {
      return false;
    }

    const elapsedHours = (updatedAtTs - openedAtTs) / 3600;
    if (elapsedHours < normalized.timeStopHours) {
      return false;
    }

    const firstTakeProfitTarget = takeProfitSteps[0]?.targetPercent || 0;
    const firstTakeProfitPrice =
      Number(position.entry_price ?? position.entryPrice ?? 0) *
      (1 + firstTakeProfitTarget / 100);

    return (
      Number(position.tp_stage ?? position.tpStage ?? 0) === 0 &&
      Number(currentPrice || 0) < firstTakeProfitPrice
    );
  }

  function calculateNextPositionState(
    { position, currentPrice, updatedAt, settings, takeProfitSteps },
    { mode, updatedAtIso = null } = {}
  ) {
    const normalizedSettings = normalizePaperTradeSettings(settings);
    let remainingTokenAmount = Number(
      position.remaining_token_amount ??
        position.remainingTokenAmount ??
        position.token_amount ??
        position.tokenAmount ??
        0
    );
    let remainingCostBasisUsd = Number(
      position.remaining_position_size_usd ??
        position.remainingPositionSizeUsd ??
        position.position_size_usd ??
        position.positionSizeUsd ??
        0
    );
    let realizedPnlUsd = Number(position.realized_pnl_usd ?? position.realizedPnlUsd ?? 0);
    let realizedProceedsUsd = Number(
      position.realized_proceeds_usd ?? position.realizedProceedsUsd ?? 0
    );
    let tpStage = Number(position.tp_stage ?? position.tpStage ?? 0);
    let lastExecutionPrice = currentPrice;
    const entryPrice = Number(position.entry_price ?? position.entryPrice ?? 0);
    const tokenAmount = Number(position.token_amount ?? position.tokenAmount ?? 0);
    const positionSizeUsd = Number(position.position_size_usd ?? position.positionSizeUsd ?? 0);
    const stopLossPercent = Number(
      position.stop_loss_pct ?? position.stopLossPct ?? normalizedSettings.stopLossPercent
    );
    const peakPrice = getPositionPeakPrice(position, currentPrice, entryPrice);

    while (tpStage < takeProfitSteps.length && remainingTokenAmount > 0) {
      const step = takeProfitSteps[tpStage];
      const tpPrice = entryPrice * (1 + step.targetPercent / 100);
      if (currentPrice < tpPrice) {
        break;
      }

      let targetSellTokenAmount = tokenAmount * Math.min(step.sellPercent / 100, 1);
      if (step.sellMode === 'remaining_percent') {
        targetSellTokenAmount = remainingTokenAmount * Math.min(step.sellPercent / 100, 1);
      } else if (step.sellMode === 'recover_principal') {
        const principalStillNeeded = Math.max(0, positionSizeUsd - realizedProceedsUsd);
        targetSellTokenAmount = findTokenAmountForNetProceeds(
          position.chain,
          currentPrice,
          remainingTokenAmount,
          principalStillNeeded
        );
      }
      const sellTokenAmount = Math.min(remainingTokenAmount, roundTo(targetSellTokenAmount, 6));
      if (sellTokenAmount <= 0) {
        break;
      }

      const costBasisSoldUsd =
        remainingTokenAmount > 0
          ? roundTo(
              mulBn(remainingCostBasisUsd, divBn(sellTokenAmount, remainingTokenAmount)),
              6
            )
          : 0;
      const sellExecution = getSellExecution({
        chain: position.chain,
        quotedPrice: currentPrice,
        tokenAmount: sellTokenAmount,
      });
      const proceedsUsd = roundTo(sellExecution.netProceedsUsd, 6);
      lastExecutionPrice = sellExecution.effectivePrice;
      realizedProceedsUsd = roundTo(addBn(realizedProceedsUsd, proceedsUsd), 6);
      realizedPnlUsd = roundTo(addBn(realizedPnlUsd, subBn(proceedsUsd, costBasisSoldUsd)), 6);
      remainingTokenAmount = Math.max(
        0,
        roundTo(subBn(remainingTokenAmount, sellTokenAmount), 6)
      );
      remainingCostBasisUsd = Math.max(
        0,
        roundTo(subBn(remainingCostBasisUsd, costBasisSoldUsd), 6)
      );
      tpStage += 1;
    }

    const nextTakeProfitPct =
      takeProfitSteps[tpStage]?.targetPercent ||
      takeProfitSteps[takeProfitSteps.length - 1]?.targetPercent ||
      0;
    const pnlSnapshot =
      mode === 'memory'
        ? getOpenPositionMarkToMarketState(
            {
              ...position,
              currentPrice,
              remainingTokenAmount,
              remainingPositionSizeUsd: remainingCostBasisUsd,
              realizedPnlUsd,
            },
            currentPrice
          )
        : getOpenPositionMarkToMarket(
            {
              ...position,
              current_price: currentPrice,
              remaining_token_amount: remainingTokenAmount,
              remaining_position_size_usd: remainingCostBasisUsd,
              realized_pnl_usd: realizedPnlUsd,
            },
            currentPrice
          );
    const peakPnlPct =
      positionSizeUsd > 0
        ? roundTo(
            mulBn(
              divBn(subBn(mulBn(peakPrice, tokenAmount), positionSizeUsd), positionSizeUsd || 1),
              100
            ),
            2
          )
        : 0;

    if (remainingTokenAmount <= 0) {
      return buildClosedState({
        currentPrice,
        closePrice: lastExecutionPrice,
        closeReason: `take_profit_stage_${tpStage}`,
        updatedAt,
        updatedAtIso,
        realizedPnlUsd,
        realizedProceedsUsd,
        tpStage,
        takeProfitSteps,
        takeProfitPct: nextTakeProfitPct,
        stopLossPct: stopLossPercent,
        peakPrice,
        peakPnlPct,
        positionSizeUsd,
      });
    }

    const protectedExitPrice = entryPrice * (1 + normalizedSettings.tp1ProtectionPercent / 100);
    if (tpStage > 0 && currentPrice <= protectedExitPrice) {
      const finalState = closeRemainingPosition({
        chain: position.chain,
        currentPrice,
        remainingTokenAmount,
        remainingCostBasisUsd,
        realizedPnlUsd,
        realizedProceedsUsd,
      });
      return buildClosedState({
        currentPrice,
        closePrice: finalState.executionPrice,
        closeReason: `tp1_protection_${normalizedSettings.tp1ProtectionPercent}`,
        updatedAt,
        updatedAtIso,
        realizedPnlUsd: finalState.realizedPnlUsd,
        realizedProceedsUsd: finalState.realizedProceedsUsd,
        tpStage,
        takeProfitSteps,
        takeProfitPct: nextTakeProfitPct,
        stopLossPct: stopLossPercent,
        peakPrice,
        peakPnlPct,
        positionSizeUsd,
      });
    }

    const openedAtTs = getPositionOpenedAtTs(position);
    const elapsedMinutes = openedAtTs > 0 ? (updatedAt - openedAtTs) / 60 : 0;
    const fastFailurePrice = entryPrice * (1 - normalizedSettings.fastFailureLossPercent / 100);
    if (
      tpStage === 0 &&
      normalizedSettings.fastFailureMinutes > 0 &&
      normalizedSettings.fastFailureLossPercent > 0 &&
      elapsedMinutes >= normalizedSettings.fastFailureMinutes &&
      currentPrice <= fastFailurePrice
    ) {
      const finalState = closeRemainingPosition({
        chain: position.chain,
        currentPrice,
        remainingTokenAmount,
        remainingCostBasisUsd,
        realizedPnlUsd,
        realizedProceedsUsd,
      });
      return buildClosedState({
        currentPrice,
        closePrice: finalState.executionPrice,
        closeReason: `fast_failure_${normalizedSettings.fastFailureMinutes}m_${normalizedSettings.fastFailureLossPercent}`,
        updatedAt,
        updatedAtIso,
        realizedPnlUsd: finalState.realizedPnlUsd,
        realizedProceedsUsd: finalState.realizedProceedsUsd,
        tpStage,
        takeProfitSteps,
        takeProfitPct: nextTakeProfitPct,
        stopLossPct: stopLossPercent,
        peakPrice,
        peakPnlPct,
        positionSizeUsd,
      });
    }

    const slPrice = entryPrice * (1 - stopLossPercent / 100);
    if (currentPrice <= slPrice + Math.abs(entryPrice) * 1e-12) {
      const finalState = closeRemainingPosition({
        chain: position.chain,
        currentPrice,
        remainingTokenAmount,
        remainingCostBasisUsd,
        realizedPnlUsd,
        realizedProceedsUsd,
      });
      return buildClosedState({
        currentPrice,
        closePrice: finalState.executionPrice,
        closeReason: `stop_loss_${stopLossPercent}`,
        updatedAt,
        updatedAtIso,
        realizedPnlUsd: finalState.realizedPnlUsd,
        realizedProceedsUsd: finalState.realizedProceedsUsd,
        tpStage,
        takeProfitSteps,
        takeProfitPct: nextTakeProfitPct,
        stopLossPct: stopLossPercent,
        peakPrice,
        peakPnlPct,
        positionSizeUsd,
      });
    }

    if (shouldCloseForTimeStop(position, currentPrice, updatedAt, takeProfitSteps, normalizedSettings)) {
      const finalState = closeRemainingPosition({
        chain: position.chain,
        currentPrice,
        remainingTokenAmount,
        remainingCostBasisUsd,
        realizedPnlUsd,
        realizedProceedsUsd,
      });
      return buildClosedState({
        currentPrice,
        closePrice: finalState.executionPrice,
        closeReason: `time_stop_${normalizedSettings.timeStopHours}h`,
        updatedAt,
        updatedAtIso,
        realizedPnlUsd: finalState.realizedPnlUsd,
        realizedProceedsUsd: finalState.realizedProceedsUsd,
        tpStage,
        takeProfitSteps,
        takeProfitPct: nextTakeProfitPct,
        stopLossPct: stopLossPercent,
        peakPrice,
        peakPnlPct,
        positionSizeUsd,
      });
    }

    return {
      currentPrice,
      pnlPct: roundTo(pnlSnapshot.pnlPct, 2),
      ...(mode === 'memory' ? { updatedAt: updatedAtIso } : {}),
      remainingTokenAmount,
      remainingPositionSizeUsd: roundTo(remainingCostBasisUsd, 2),
      realizedPnlUsd: roundTo(realizedPnlUsd, 2),
      realizedProceedsUsd: roundTo(realizedProceedsUsd, 2),
      tpStage,
      takeProfitSteps,
      takeProfitPct: nextTakeProfitPct,
      stopLossPct: stopLossPercent,
      peakPrice: roundTo(peakPrice, 8),
      peakPnlPct,
      currentValueUsd: roundTo(pnlSnapshot.currentValueUsd, 2),
      pnlUsd: roundTo(pnlSnapshot.pnlUsd, 2),
    };
  }

  function closeRemainingPosition({
    chain,
    currentPrice,
    remainingTokenAmount,
    remainingCostBasisUsd,
    realizedPnlUsd,
    realizedProceedsUsd,
  }) {
    const execution = getSellExecution({ chain, quotedPrice: currentPrice, tokenAmount: remainingTokenAmount });
    const finalProceedsUsd = roundTo(execution.netProceedsUsd, 6);

    return {
      executionPrice: execution.effectivePrice,
      realizedProceedsUsd: roundTo(addBn(realizedProceedsUsd, finalProceedsUsd), 6),
      realizedPnlUsd: roundTo(
        addBn(realizedPnlUsd, subBn(finalProceedsUsd, remainingCostBasisUsd)),
        6
      ),
    };
  }

  function findTokenAmountForNetProceeds(chain, quotedPrice, maxTokenAmount, targetNetUsd) {
    if (targetNetUsd <= 0 || maxTokenAmount <= 0) {
      return 0;
    }
    const maxExecution = getSellExecution({ chain, quotedPrice, tokenAmount: maxTokenAmount });
    if (maxExecution.netProceedsUsd <= targetNetUsd) {
      return maxTokenAmount;
    }

    let low = 0;
    let high = maxTokenAmount;
    for (let index = 0; index < 40; index += 1) {
      const middle = (low + high) / 2;
      const execution = getSellExecution({ chain, quotedPrice, tokenAmount: middle });
      if (execution.netProceedsUsd < targetNetUsd) {
        low = middle;
      } else {
        high = middle;
      }
    }
    return high;
  }

  function buildManualCloseState(
    { position, currentPrice, updatedAt, takeProfitSteps, settings, closeReason },
    { mode, updatedAtIso = null } = {}
  ) {
    const remainingTokenAmount = Number(
      position.remaining_token_amount ??
        position.remainingTokenAmount ??
        position.token_amount ??
        position.tokenAmount ??
        0
    );
    const remainingCostBasisUsd = Number(
      position.remaining_position_size_usd ??
        position.remainingPositionSizeUsd ??
        position.position_size_usd ??
        position.positionSizeUsd ??
        0
    );
    const realizedPnlUsd = Number(position.realized_pnl_usd ?? position.realizedPnlUsd ?? 0);
    const realizedProceedsUsd = Number(
      position.realized_proceeds_usd ?? position.realizedProceedsUsd ?? 0
    );
    const entryPrice = Number(position.entry_price ?? position.entryPrice ?? 0);
    const positionSizeUsd = Number(position.position_size_usd ?? position.positionSizeUsd ?? 0);
    const stopLossPct = Number(
      position.stop_loss_pct ?? position.stopLossPct ?? settings.stopLossPercent
    );
    const tpStage = Number(position.tp_stage ?? position.tpStage ?? 0);
    const nextTakeProfitPct =
      takeProfitSteps[tpStage]?.targetPercent ||
      takeProfitSteps[takeProfitSteps.length - 1]?.targetPercent ||
      0;
    const peakPrice = getPositionPeakPrice(position, currentPrice, entryPrice);
    const tokenAmount = Number(position.token_amount ?? position.tokenAmount ?? 0);
    const peakPnlPct =
      positionSizeUsd > 0
        ? roundTo(
            mulBn(
              divBn(subBn(mulBn(peakPrice, tokenAmount), positionSizeUsd), positionSizeUsd || 1),
              100
            ),
            2
          )
        : 0;
    const finalState = closeRemainingPosition({
      chain: position.chain,
      currentPrice,
      remainingTokenAmount,
      remainingCostBasisUsd,
      realizedPnlUsd,
      realizedProceedsUsd,
    });

    return buildClosedState({
      currentPrice,
      closePrice: finalState.executionPrice,
      closeReason,
      updatedAt,
      updatedAtIso,
      realizedPnlUsd: finalState.realizedPnlUsd,
      realizedProceedsUsd: finalState.realizedProceedsUsd,
      tpStage,
      takeProfitSteps,
      takeProfitPct: nextTakeProfitPct,
      stopLossPct,
      peakPrice,
      peakPnlPct,
      positionSizeUsd,
    });
  }

  function buildClosedState({
    currentPrice,
    closePrice = currentPrice,
    closeReason,
    updatedAt,
    updatedAtIso,
    realizedPnlUsd,
    realizedProceedsUsd,
    tpStage,
    takeProfitSteps,
    takeProfitPct,
    stopLossPct,
    peakPrice,
    peakPnlPct,
    positionSizeUsd,
  }) {
    const pnlPct = roundTo((realizedPnlUsd / Number(positionSizeUsd || 1)) * 100, 2);
    const shared = {
      status: 'closed',
      currentPrice,
      closePrice,
      closeReason,
      pnlPct,
      remainingTokenAmount: 0,
      remainingPositionSizeUsd: 0,
      realizedPnlUsd: roundTo(realizedPnlUsd, 2),
      realizedProceedsUsd: roundTo(realizedProceedsUsd, 2),
      tpStage,
      takeProfitSteps,
      takeProfitPct,
      stopLossPct,
      peakPrice: roundTo(peakPrice, 8),
      peakPnlPct,
      currentValueUsd: 0,
      pnlUsd: roundTo(realizedPnlUsd, 2),
    };

    if (updatedAtIso) {
      return {
        ...shared,
        updatedAt: updatedAtIso,
        closedAt: updatedAtIso,
      };
    }

    return {
      ...shared,
      updatedAt,
      closedAt: updatedAt,
    };
  }

  return {
    buildManualCloseState,
    calculateNextPositionState,
  };
}
