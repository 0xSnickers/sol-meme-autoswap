export function createPaperPositionSizer({
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
}) {
  function getPaperPositionSizingByMetrics(smartMoney, tradeScore, price) {
    let multiplier = 0.7;

    if (tradeScore >= 85) {
      multiplier = 1.2;
    } else if (tradeScore >= 80) {
      multiplier = 1;
    }

    if (smartMoney >= 8 && tradeScore >= 80) {
      multiplier = Math.min(multiplier + 0.05, 1.2);
    }

    const positionSizeUsd = Number((paperBasePositionUsd * multiplier).toFixed(2));
    const tokenAmount = price > 0 ? Number((positionSizeUsd / price).toFixed(6)) : 0;

    return {
      multiplier,
      positionSizeUsd,
      tokenAmount,
    };
  }

  function getPaperPositionSizing(alert, tradePlan) {
    return getPaperPositionSizingByMetrics(
      alert.token.sm || 0,
      tradePlan.tradeScore || 0,
      alert.token.price || 0
    );
  }

  function getPaperTargetPositionSizing(alert, tradePlan) {
    const baseSizing = getPaperPositionSizing(alert, tradePlan);
    const maxSinglePositionUsd = roundTo(
      mulBn(paperTotalCapitalUsd, divBn(paperMaxSinglePositionPct, 100)),
      2
    );
    const targetPositionSizeUsd = roundTo(
      Math.min(baseSizing.positionSizeUsd, maxSinglePositionUsd || baseSizing.positionSizeUsd),
      2
    );
    const targetTokenAmount =
      Number(alert?.token?.price || 0) > 0
        ? roundTo(divBn(targetPositionSizeUsd, Number(alert.token.price || 0)), 6)
        : 0;

    return {
      ...baseSizing,
      targetPositionSizeUsd,
      targetTokenAmount,
      maxSinglePositionUsd,
    };
  }

  function getPaperEntrySizing(alert, tradePlan, position = null) {
    const targetSizing = getPaperTargetPositionSizing(alert, tradePlan);
    const entryPrice = Number(alert?.token?.price || 0);
    const currentPositionSizeUsd = Number(
      position?.position_size_usd ?? position?.positionSizeUsd ?? 0
    );
    const currentStage = getPositionEntryStage(position);
    const targetPositionSizeUsd = position
      ? Math.max(currentPositionSizeUsd, getPositionTargetPositionSizeUsd(position))
      : targetSizing.targetPositionSizeUsd;
    const nextStageIndex = position ? currentStage : 0;
    const configuredStageUsd =
      targetPositionSizeUsd * (paperEntryStageAllocations[nextStageIndex] || 0);
    const remainingUsd = Math.max(
      0,
      roundTo(subBn(targetPositionSizeUsd, currentPositionSizeUsd), 2)
    );
    const stagePositionSizeUsd =
      nextStageIndex >= paperEntryStageAllocations.length
        ? 0
        : roundTo(
            nextStageIndex === paperEntryStageAllocations.length - 1
              ? remainingUsd
              : Math.min(configuredStageUsd, remainingUsd),
            2
          );
    const tokenAmount = entryPrice > 0 ? roundTo(divBn(stagePositionSizeUsd, entryPrice), 6) : 0;
    const nextEntryStage = Math.min(paperEntryStageAllocations.length, currentStage + 1);
    const filledPositionPct =
      targetPositionSizeUsd > 0
        ? roundTo(
            mulBn(
              divBn(addBn(currentPositionSizeUsd, stagePositionSizeUsd), targetPositionSizeUsd),
              100
            ),
            1
          )
        : 0;

    return {
      ...targetSizing,
      positionSizeUsd: stagePositionSizeUsd,
      tokenAmount,
      targetPositionSizeUsd,
      nextEntryStage,
      filledPositionPct,
    };
  }

  return {
    getPaperEntrySizing,
    getPaperPositionSizing,
    getPaperPositionSizingByMetrics,
    getPaperTargetPositionSizing,
  };
}
