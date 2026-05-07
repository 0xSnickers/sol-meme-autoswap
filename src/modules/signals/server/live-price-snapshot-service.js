export function createLivePriceSnapshotService({
  addBn,
  divBn,
  fetchJson,
  fetchNewTokens,
  getPersistedRadarSnapshot,
  mulBn,
  paperTotalCapitalUsd,
  roundTo,
  subBn,
  sumBn,
}) {
  async function fetchDexScreenerPrice(address) {
    try {
      const json = await fetchJson(
        `https://api.dexscreener.com/latest/dex/tokens/${address}`,
        {},
        8_000
      );
      const pairs = json.pairs || [];
      if (pairs.length === 0) {
        return null;
      }

      const bestPair = [...pairs].sort((left, right) => {
        const leftLiquidity = Number(left?.liquidity?.usd || 0);
        const rightLiquidity = Number(right?.liquidity?.usd || 0);
        return rightLiquidity - leftLiquidity;
      })[0];
      const price = Number(bestPair?.priceUsd || 0);
      return price > 0 ? price : null;
    } catch {
      return null;
    }
  }

  async function fetchTrackedLivePrices(trackedTokens) {
    const priceMap = new Map();
    if (!trackedTokens.length) {
      return priceMap;
    }

    const targetKeys = new Set(trackedTokens.map((token) => `${token.chain}:${token.address}`));

    try {
      const gmgnTokens = await fetchNewTokens();
      for (const token of gmgnTokens) {
        const key = `${token.chain}:${token.address}`;
        if (targetKeys.has(key) && token.price > 0) {
          priceMap.set(key, Number(token.price));
        }
      }
    } catch {
      // Ignore and fall back to DexScreener when GMGN quote fetch fails.
    }

    const missingTokens = trackedTokens.filter(
      (token) => !priceMap.has(`${token.chain}:${token.address}`)
    );

    await Promise.all(
      missingTokens.map(async (token) => {
        const price = await fetchDexScreenerPrice(token.address);
        if (price != null && price > 0) {
          priceMap.set(`${token.chain}:${token.address}`, price);
        }
      })
    );

    return priceMap;
  }

  function applyLivePriceToPaperPosition(position, livePrice) {
    if (!livePrice || !position.entryPrice) {
      return position;
    }

    const remainingTokenAmount = Number(position.remainingTokenAmount ?? position.tokenAmount ?? 0);
    const remainingPositionSizeUsd = Number(
      position.remainingPositionSizeUsd ?? position.positionSizeUsd ?? 0
    );
    const realizedPnlUsd = Number(position.realizedPnlUsd || 0);
    const currentValueUsd = roundTo(mulBn(remainingTokenAmount, livePrice), 2);
    const pnlUsd = roundTo(
      addBn(realizedPnlUsd, subBn(currentValueUsd, remainingPositionSizeUsd)),
      2
    );
    const pnlPct =
      position.positionSizeUsd > 0
        ? roundTo(mulBn(divBn(pnlUsd, position.positionSizeUsd), 100), 2)
        : position.pnlPct;

    return {
      ...position,
      currentPrice: livePrice,
      currentValueUsd,
      pnlUsd,
      pnlPct,
    };
  }

  function rebuildPaperSummaryWithLivePositions(baseSummary, liveOpenPositions) {
    const totalCapitalUsd = Number(baseSummary?.totalCapitalUsd || paperTotalCapitalUsd);
    const closedCostUsd = Number(baseSummary?.closedCostUsd || 0);
    const closedSellUsd = Number(baseSummary?.closedValueUsd || 0);
    const closedPnLUsd = Number(baseSummary?.closedPnLUsd || 0);
    const openCostUsd = sumBn(
      liveOpenPositions.map((position) => position.remainingPositionSizeUsd || 0)
    );
    const openOriginalCostUsd = sumBn(
      liveOpenPositions.map((position) => position.positionSizeUsd || 0)
    );
    const openValueUsd = sumBn(liveOpenPositions.map((position) => position.currentValueUsd || 0));
    const openRealizedProceedsUsd = sumBn(
      liveOpenPositions.map((position) => position.realizedProceedsUsd || 0)
    );
    const openPnLUsd = addBn(
      sumBn(liveOpenPositions.map((position) => position.realizedPnlUsd || 0)),
      subBn(openValueUsd, openCostUsd)
    );
    const cashBalanceUsd = addBn(
      subBn(totalCapitalUsd, addBn(closedCostUsd, openOriginalCostUsd)),
      closedSellUsd,
      openRealizedProceedsUsd
    );
    const equityUsd = addBn(cashBalanceUsd, openValueUsd);
    const totalPnLUsd = addBn(closedPnLUsd, openPnLUsd);
    const capitalUsagePct =
      totalCapitalUsd > 0 ? roundTo(mulBn(divBn(openCostUsd, totalCapitalUsd), 100), 2) : 0;

    return {
      ...baseSummary,
      openCount: liveOpenPositions.length,
      openCostUsd,
      openValueUsd,
      openPnLUsd,
      cashBalanceUsd,
      availableUsd: cashBalanceUsd,
      usedCapitalUsd: openCostUsd,
      equityUsd,
      capitalUsagePct,
      totalPnLUsd,
    };
  }

  async function getRealtimeRadarSnapshot(limit = 60) {
    const snapshot = await getPersistedRadarSnapshot(limit);
    const trackedTokens = [];
    const seen = new Set();

    for (const position of snapshot.paperPositions || []) {
      const key = `${position.chain}:${position.address}`;
      if (!seen.has(key)) {
        seen.add(key);
        trackedTokens.push({ chain: position.chain, address: position.address });
      }
    }

    for (const alert of (snapshot.alerts || []).slice(0, 20)) {
      const key = `${alert.chain}:${alert.address}`;
      if (!seen.has(key)) {
        seen.add(key);
        trackedTokens.push({ chain: alert.chain, address: alert.address });
      }
    }

    if (!trackedTokens.length) {
      return {
        ...snapshot,
        liveUpdatedAt: new Date().toISOString(),
        liveMode: 'server_push',
      };
    }

    const livePriceMap = await fetchTrackedLivePrices(trackedTokens);
    const paperPositions = (snapshot.paperPositions || []).map((position) =>
      applyLivePriceToPaperPosition(
        position,
        livePriceMap.get(`${position.chain}:${position.address}`) || null
      )
    );
    const paperPositionMap = new Map(
      paperPositions.map((position) => [`${position.chain}:${position.address}`, position])
    );
    const alerts = (snapshot.alerts || []).map((alert) => {
      const key = `${alert.chain}:${alert.address}`;
      const livePrice = livePriceMap.get(key);
      const livePosition = paperPositionMap.get(key);

      return {
        ...alert,
        price: livePrice || alert.price,
        paperCurrentPrice: livePosition?.currentPrice ?? alert.paperCurrentPrice,
        paperPnLPct: livePosition?.pnlPct ?? alert.paperPnLPct,
      };
    });

    return {
      ...snapshot,
      paperSummary: rebuildPaperSummaryWithLivePositions(snapshot.paperSummary, paperPositions),
      paperPositions,
      alerts,
      liveUpdatedAt: new Date().toISOString(),
      liveMode: 'server_push',
    };
  }

  return {
    getRealtimeRadarSnapshot,
  };
}
