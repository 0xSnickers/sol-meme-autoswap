'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_CONFIG } from '../../../config/app-config.js';
import { fetchSignalSnapshot } from './signal-api-client.js';

const INITIAL_HEADER_META = {
  strategyRuntimeLabel: '',
  strategyRuntimeSeconds: 0,
  strategyStartedAt: '',
};

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function roundTo(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(toNumber(value) * factor) / factor;
}

function buildPositionLiveKey(position = {}) {
  if (position?.id != null) {
    return `id:${position.id}`;
  }
  return `${position?.chain || ''}:${position?.address || ''}`;
}

function rebuildPaperSummaryWithLivePositions(baseSummary, liveOpenPositions) {
  const totalCapitalUsd = toNumber(baseSummary?.totalCapitalUsd);
  const closedCostUsd = toNumber(baseSummary?.closedCostUsd);
  const closedSellUsd = toNumber(baseSummary?.closedValueUsd);
  const closedPnLUsd = toNumber(baseSummary?.closedPnLUsd);
  const openCostUsd = roundTo(
    liveOpenPositions.reduce(
      (sum, position) => sum + toNumber(position.remainingPositionSizeUsd ?? position.positionSizeUsd),
      0
    )
  );
  const openOriginalCostUsd = roundTo(
    liveOpenPositions.reduce((sum, position) => sum + toNumber(position.positionSizeUsd), 0)
  );
  const openValueUsd = roundTo(
    liveOpenPositions.reduce((sum, position) => sum + toNumber(position.currentValueUsd), 0)
  );
  const openRealizedProceedsUsd = roundTo(
    liveOpenPositions.reduce((sum, position) => sum + toNumber(position.realizedProceedsUsd), 0)
  );
  const openRealizedPnlUsd = roundTo(
    liveOpenPositions.reduce((sum, position) => sum + toNumber(position.realizedPnlUsd), 0)
  );
  const openPnLUsd = roundTo(openRealizedPnlUsd + (openValueUsd - openCostUsd));
  const cashBalanceUsd = roundTo(
    totalCapitalUsd - (closedCostUsd + openOriginalCostUsd) + closedSellUsd + openRealizedProceedsUsd
  );
  const equityUsd = roundTo(cashBalanceUsd + openValueUsd);
  const totalPnLUsd = roundTo(closedPnLUsd + openPnLUsd);
  const capitalUsagePct =
    totalCapitalUsd > 0 ? roundTo((openCostUsd / totalCapitalUsd) * 100, 2) : 0;

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

function applyLivePriceToPaperPosition(position, livePrice) {
  if (!livePrice || !position?.entryPrice) {
    return position;
  }

  const remainingTokenAmount = toNumber(position.remainingTokenAmount ?? position.tokenAmount);
  const remainingPositionSizeUsd = toNumber(
    position.remainingPositionSizeUsd ?? position.positionSizeUsd
  );
  const realizedPnlUsd = toNumber(position.realizedPnlUsd);
  const currentValueUsd = roundTo(remainingTokenAmount * toNumber(livePrice));
  const pnlUsd = roundTo(realizedPnlUsd + (currentValueUsd - remainingPositionSizeUsd));
  const pnlPct =
    toNumber(position.positionSizeUsd) > 0
      ? roundTo((pnlUsd / toNumber(position.positionSizeUsd)) * 100)
      : position.pnlPct;

  return {
    ...position,
    currentPrice: livePrice,
    currentValueUsd,
    pnlUsd,
    pnlPct,
  };
}

function mergeLiveSnapshot(currentSnapshot, nextSnapshot) {
  if (!currentSnapshot?.liveUpdatedAt || nextSnapshot?.liveUpdatedAt) {
    return nextSnapshot;
  }

  const currentPositionMap = new Map(
    (currentSnapshot.paperPositions || []).map((position) => [buildPositionLiveKey(position), position])
  );

  const paperPositions = (nextSnapshot.paperPositions || []).map((position) => {
    const currentPosition = currentPositionMap.get(buildPositionLiveKey(position));
    if (!currentPosition) {
      return position;
    }

    return applyLivePriceToPaperPosition(position, currentPosition.currentPrice);
  });

  const livePositionMap = new Map(
    paperPositions.map((position) => [`${position.chain}:${position.address}`, position])
  );
  const currentAlertMap = new Map(
    (currentSnapshot.alerts || []).map((alert) => [`${alert.chain}:${alert.address}`, alert])
  );
  const alerts = (nextSnapshot.alerts || []).map((alert) => {
    const key = `${alert.chain}:${alert.address}`;
    const currentAlert = currentAlertMap.get(key);
    const livePosition = livePositionMap.get(key);

    return {
      ...alert,
      price: currentAlert?.price ?? alert.price,
      paperCurrentPrice:
        livePosition?.currentPrice ?? currentAlert?.paperCurrentPrice ?? alert.paperCurrentPrice,
      paperPnLPct: livePosition?.pnlPct ?? currentAlert?.paperPnLPct ?? alert.paperPnLPct,
    };
  });

  return {
    ...nextSnapshot,
    paperSummary: rebuildPaperSummaryWithLivePositions(nextSnapshot.paperSummary, paperPositions),
    paperPositions,
    alerts,
    latestSignal: alerts[0] || nextSnapshot.latestSignal || null,
    liveUpdatedAt: currentSnapshot.liveUpdatedAt,
    liveMode: currentSnapshot.liveMode || nextSnapshot.liveMode,
  };
}

export function useSignalSnapshot({
  limit = APP_CONFIG.signals.snapshotLimit,
  pollSeconds = APP_CONFIG.signals.pollSeconds,
  enabled = true,
  errorMessage = '读取信号快照失败',
  onSnapshot,
} = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(pollSeconds);
  const [headerMeta, setHeaderMeta] = useState(INITIAL_HEADER_META);
  const dataRef = useRef(null);
  const nextPollAtRef = useRef(0);

  const syncCountdown = useCallback(() => {
    if (!nextPollAtRef.current) {
      return;
    }

    const remainingSeconds = Math.max(0, Math.ceil((nextPollAtRef.current - Date.now()) / 1000));
    setCountdown(remainingSeconds);
  }, []);

  const applySnapshot = useCallback(
    (json, { resetCountdown = true } = {}) => {
      const mergedSnapshot = mergeLiveSnapshot(dataRef.current, json);
      dataRef.current = mergedSnapshot;
      setData(mergedSnapshot);
      setHeaderMeta((current) => ({
        strategyRuntimeLabel: mergedSnapshot.strategyRuntimeLabel || current.strategyRuntimeLabel,
        strategyRuntimeSeconds:
          mergedSnapshot.strategyRuntimeSeconds ?? current.strategyRuntimeSeconds,
        strategyStartedAt: mergedSnapshot.strategyStartedAt || current.strategyStartedAt,
      }));
      setError('');
      setLoading(false);
      if (resetCountdown) {
        nextPollAtRef.current = Date.now() + pollSeconds * 1000;
        syncCountdown();
      }
      onSnapshot?.(mergedSnapshot);
    },
    [onSnapshot, pollSeconds, syncCountdown]
  );

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let disposed = false;
    let pollTimer = null;

    function clearPollTimer() {
      if (pollTimer) {
        window.clearTimeout(pollTimer);
        pollTimer = null;
      }
    }

    function scheduleNextLoad() {
      clearPollTimer();
      nextPollAtRef.current = Date.now() + pollSeconds * 1000;
      syncCountdown();
      pollTimer = window.setTimeout(() => {
        void load('persisted');
      }, pollSeconds * 1000);
    }

    async function load(mode = 'persisted') {
      try {
        setError('');
        const json = await fetchSignalSnapshot({ limit, mode });
        if (!disposed) {
          applySnapshot(json, { resetCountdown: false });
          scheduleNextLoad();
        }
      } catch (requestError) {
        if (!disposed) {
          setError(requestError instanceof Error ? requestError.message : errorMessage);
          setLoading(false);
          scheduleNextLoad();
        }
      }
    }

    void load('realtime');
    const countdownTimer = window.setInterval(() => {
      syncCountdown();
    }, 1000);

    return () => {
      disposed = true;
      nextPollAtRef.current = 0;
      clearPollTimer();
      window.clearInterval(countdownTimer);
    };
  }, [applySnapshot, enabled, errorMessage, limit, pollSeconds, syncCountdown]);

  return {
    data,
    error,
    loading,
    countdown,
    headerMeta,
    setData,
    setError,
    setLoading,
    setHeaderMeta,
    applySnapshot,
  };
}
