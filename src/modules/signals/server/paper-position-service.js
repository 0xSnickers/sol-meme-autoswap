import { normalizeTakeProfitSteps } from '../lib/paper-trade-settings.js';

export function getPositionEntryStage(position, entryStageAllocations = [1]) {
  return Math.max(
    0,
    Math.min(
      entryStageAllocations.length,
      Number(position?.entry_stage ?? position?.entryStage ?? 0)
    )
  );
}

export function getPositionTargetPositionSizeUsd(position) {
  return Number(
    position?.target_position_size_usd ?? position?.targetPositionSizeUsd ?? position?.position_size_usd ??
      position?.positionSizeUsd ??
      0
  );
}

export function getOpenPositionMarkToMarketState(
  position,
  currentPriceOverride = null,
  { roundTo, mulBn, divBn, subBn, addBn } = {}
) {
  const currentPrice = Number(currentPriceOverride ?? position.currentPrice ?? 0);
  const remainingTokenAmount = Number(position.remainingTokenAmount ?? position.tokenAmount ?? 0);
  const remainingCostBasisUsd = Number(
    position.remainingPositionSizeUsd ?? position.positionSizeUsd ?? 0
  );
  const realizedPnlUsd = Number(position.realizedPnlUsd || 0);
  const currentValueUsd = roundTo(mulBn(remainingTokenAmount, currentPrice), 2);
  const pnlUsd = roundTo(addBn(realizedPnlUsd, subBn(currentValueUsd, remainingCostBasisUsd)), 2);
  const totalCostUsd = Number(position.positionSizeUsd || 0);
  const pnlPct = totalCostUsd > 0 ? roundTo(mulBn(divBn(pnlUsd, totalCostUsd), 100), 2) : 0;

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

export function normalizeRuntimePaperPositions(
  paperPositionsMap = new Map(),
  { entryStageAllocations = [1], normalizeSteps = normalizeTakeProfitSteps } = {}
) {
  return [...paperPositionsMap.values()].map((position) => ({
    ...position,
    twitter: position.twitter || '',
    positionSizeUsd: Number(position.positionSizeUsd || 0),
    tokenAmount: Number(position.tokenAmount || 0),
    remainingTokenAmount: Number(position.remainingTokenAmount ?? position.tokenAmount ?? 0),
    remainingPositionSizeUsd: Number(
      position.remainingPositionSizeUsd ?? position.positionSizeUsd ?? 0
    ),
    realizedPnlUsd: Number(position.realizedPnlUsd || 0),
    realizedProceedsUsd: Number(position.realizedProceedsUsd || 0),
    tpStage: Number(position.tpStage || 0),
    targetPositionSizeUsd: Number(
      position.targetPositionSizeUsd ?? position.positionSizeUsd ?? 0
    ),
    entryStage: Number(position.entryStage || entryStageAllocations.length),
    entryPrice: Number(position.entryPrice || 0),
    currentPrice: Number(position.currentPrice || 0),
    peakPrice: Number(position.peakPrice ?? position.currentPrice ?? position.entryPrice ?? 0),
    peakPnlPct: Number(position.peakPnlPct || 0),
    takeProfitPct: Number(position.takeProfitPct || 0),
    stopLossPct: Number(position.stopLossPct || 0),
    pnlPct: Number(position.pnlPct || 0),
    smartMoney: Number(position.smartMoney || 0),
    buySellRatio: Number(position.buySellRatio || 0),
    liquidity: Number(position.liquidity || 0),
    volume: Number(position.volume || 0),
    currentValueUsd: Number(position.currentValueUsd || 0),
    pnlUsd: Number(position.pnlUsd || 0),
    takeProfitSteps: normalizeSteps(position.takeProfitSteps || []),
  }));
}

export function getOpenPaperPositionInMemory(positions, chain, address) {
  return (
    positions.find(
      (position) => position.chain === chain && position.address === address && position.status === 'open'
    ) || null
  );
}

export function getOpenPaperPositionCountInMemory(positions) {
  return positions.filter((position) => position.status === 'open').length;
}

export function getPaperAccountSummaryFromPositions(
  positions,
  { totalCapitalUsd, roundTo, sumBn, addBn, subBn, mulBn, divBn } = {}
) {
  const openRows = positions.filter((row) => row.status === 'open');
  const closedRows = positions.filter((row) => row.status === 'closed');
  const totalOpenedCostUsd = sumBn(positions.map((row) => row.positionSizeUsd || 0));
  const openBuyUsd = sumBn(
    openRows.map((row) => row.remainingPositionSizeUsd ?? row.positionSizeUsd ?? 0)
  );
  const openMarketValueUsd = sumBn(openRows.map((row) => row.currentValueUsd || 0));
  const openRealizedProceedsUsd = sumBn(openRows.map((row) => row.realizedProceedsUsd || 0));
  const openPnLUsd = sumBn(openRows.map((row) => row.pnlUsd || 0));
  const closedBuyUsd = sumBn(closedRows.map((row) => row.positionSizeUsd || 0));
  const closedSellUsd = sumBn(closedRows.map((row) => row.realizedProceedsUsd || 0));
  const closedPnLUsd = sumBn(closedRows.map((row) => row.realizedPnlUsd || 0));
  const cashBalanceUsd = addBn(
    subBn(totalCapitalUsd, totalOpenedCostUsd),
    closedSellUsd,
    openRealizedProceedsUsd
  );
  const equityUsd = addBn(cashBalanceUsd, openMarketValueUsd);
  const totalPnLUsd = addBn(openPnLUsd, closedPnLUsd);
  const capitalUsagePct =
    totalCapitalUsd > 0 ? roundTo(mulBn(divBn(openBuyUsd, totalCapitalUsd), 100), 2) : 0;
  const winCount = closedRows.filter((row) => Number(row.pnlPct || 0) > 0).length;

  return {
    openCount: openRows.length,
    closedCount: closedRows.length,
    winCount,
    winRate:
      closedRows.length > 0 ? Number(((winCount / closedRows.length) * 100).toFixed(1)) : 0,
    openValueUsd: roundTo(openMarketValueUsd, 2),
    openCostUsd: roundTo(openBuyUsd, 2),
    openPnLUsd: roundTo(openPnLUsd, 2),
    closedCostUsd: roundTo(closedBuyUsd, 2),
    closedValueUsd: roundTo(closedSellUsd, 2),
    closedPnLUsd: roundTo(closedPnLUsd, 2),
    totalCapitalUsd: roundTo(totalCapitalUsd, 2),
    cashBalanceUsd: roundTo(cashBalanceUsd, 2),
    availableUsd: roundTo(cashBalanceUsd, 2),
    usedCapitalUsd: roundTo(openBuyUsd, 2),
    equityUsd: roundTo(equityUsd, 2),
    capitalUsagePct: roundTo(capitalUsagePct, 2),
    totalPnLUsd: roundTo(totalPnLUsd, 2),
  };
}
