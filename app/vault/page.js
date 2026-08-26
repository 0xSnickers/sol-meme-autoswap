'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_CONFIG } from '../../src/config/app-config.js';
import { withAppBasePath } from '../../src/lib/app-path.js';
import { fetchSignalSnapshot } from '../../src/modules/signals/client/signal-api-client.js';
import { useSignalSnapshot } from '../../src/modules/signals/client/use-signal-snapshot.js';
import { useSignalStream } from '../../src/modules/signals/client/use-signal-stream.js';
import AppFooter from '../components/AppFooter';
import AppHeader from '../components/AppHeader';
import { buildChainPaperSummary, CHAIN_OPTIONS, getSelectedChainLabel, useSelectedChain } from '../components/useSelectedChain';
import { PortfolioSection } from '../components/PortfolioCards';
import StrategySettingsLauncher from '../components/StrategySettingsLauncher';
import { formatDuration, formatTime, formatUsd, formatUsdValue } from '../components/formatters';

const POLL_SECONDS = APP_CONFIG.signals.pollSeconds;

function buildPaperTradeSettings(config = {}) {
  const fallbackTakeProfitSteps = Array.isArray(config?.paperTakeProfitSteps)
    ? config.paperTakeProfitSteps
    : [
        { targetPercent: 80, sellPercent: 55.56, sellMode: 'recover_principal' },
        { targetPercent: 150, sellPercent: 50, sellMode: 'remaining_percent' },
      ];

  const settings = config?.paperTradeSettings || {};
  const takeProfitSteps =
    Array.isArray(settings.takeProfitSteps) && settings.takeProfitSteps.length > 0
      ? settings.takeProfitSteps
      : fallbackTakeProfitSteps;

  return {
    stopLossPercent: Number(settings.stopLossPercent ?? config.paperStopLossPercent ?? 80),
    timeStopHours: Number(settings.timeStopHours ?? config.paperTimeStopHours ?? 0),
    tp1ProtectionPercent: Number(settings.tp1ProtectionPercent ?? 0),
    fastFailureMinutes: Number(settings.fastFailureMinutes ?? 0),
    fastFailureLossPercent: Number(settings.fastFailureLossPercent ?? 0),
    takeProfitSteps,
  };
}

function buildUpdatedConfig(config = {}, nextSettings) {
  return {
    ...config,
    paperTradeSettings: nextSettings,
    paperTakeProfitSteps: nextSettings.takeProfitSteps,
    paperStopLossPercent: nextSettings.stopLossPercent,
    paperTimeStopHours: nextSettings.timeStopHours,
  };
}


function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="strategy-settings-icon-svg">
      <path
        fill="currentColor"
        d="M8 5.75A1.25 1.25 0 0 1 9.25 4.5h1.5A1.25 1.25 0 0 1 12 5.75v12.5A1.25 1.25 0 0 1 10.75 19.5h-1.5A1.25 1.25 0 0 1 8 18.25V5.75Zm4 0A1.25 1.25 0 0 1 13.25 4.5h1.5A1.25 1.25 0 0 1 16 5.75v12.5A1.25 1.25 0 0 1 14.75 19.5h-1.5A1.25 1.25 0 0 1 12 18.25V5.75Z"
      />
    </svg>
  );
}

function MetricBuyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="vault-metric-icon-svg">
      <path
        fill="currentColor"
        d="M12 3.75a.75.75 0 0 1 .75.75v8.69l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 1.06-1.06l2.72 2.72V4.5a.75.75 0 0 1 .75-.75ZM6.5 18a.75.75 0 0 1 .75-.75h9.5a.75.75 0 0 1 0 1.5h-9.5A.75.75 0 0 1 6.5 18Z"
      />
    </svg>
  );
}

function MetricValueIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="vault-metric-icon-svg">
      <path
        fill="currentColor"
        d="M5.5 13.75a1.25 1.25 0 0 1 1.25 1.25v3.25a1.25 1.25 0 1 1-2.5 0V15a1.25 1.25 0 0 1 1.25-1.25Zm6.5-8a1.25 1.25 0 0 1 1.25 1.25v11.25a1.25 1.25 0 1 1-2.5 0V7A1.25 1.25 0 0 1 12 5.75Zm6.5 4a1.25 1.25 0 0 1 1.25 1.25v7.25a1.25 1.25 0 1 1-2.5 0V11a1.25 1.25 0 0 1 1.25-1.25Z"
      />
    </svg>
  );
}

function MetricPnlIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="vault-metric-icon-svg">
      <path
        fill="currentColor"
        d="M5 16.75a.75.75 0 0 1 1.28-.53l2.66 2.65 4.9-6.54a.75.75 0 0 1 1.12-.08l2.3 2.3V8.75a.75.75 0 0 1 1.5 0V16a.75.75 0 0 1-.75.75h-7.25a.75.75 0 0 1 0-1.5h5.24l-1.58-1.58-4.9 6.54a.75.75 0 0 1-1.1.08l-3.2-3.19A.75.75 0 0 1 5 16.75Z"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="vault-chip-icon-svg">
      <path
        fill="currentColor"
        d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 1.5A6.5 6.5 0 1 1 3.5 10 6.5 6.5 0 0 1 10 3.5Zm0 2.25a.75.75 0 0 1 .75.75v3.19l2.27 1.31a.75.75 0 0 1-.75 1.3l-2.65-1.53a.75.75 0 0 1-.37-.65V6.5A.75.75 0 0 1 10 5.75Z"
      />
    </svg>
  );
}

function InfoTooltipIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="bulk-close-tooltip-icon">
      <path
        fill="currentColor"
        d="M10 1.75a8.25 8.25 0 1 0 0 16.5 8.25 8.25 0 0 0 0-16.5Zm0 3.5a1.12 1.12 0 1 1 0 2.25 1.12 1.12 0 0 1 0-2.25Zm1.1 9.1H8.9v-1.2h.65V9.55H8.9v-1.2h1.9v4.8h.3v1.2Z"
      />
    </svg>
  );
}

export default function VaultPage() {
  const [selectedChain, setSelectedChain] = useSelectedChain();
  const [pollFallbackEnabled, setPollFallbackEnabled] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');
  const [closeError, setCloseError] = useState('');
  const [closingPositionId, setClosingPositionId] = useState(null);
  const [closingAll, setClosingAll] = useState(false);
  const lastScrollYRef = useRef(0);
  const preserveScrollAfterUpdate = useCallback(() => {
    const nextScrollY = lastScrollYRef.current;
    window.requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - nextScrollY) > 4) {
        window.scrollTo({ top: nextScrollY, behavior: 'auto' });
      }
    });
  }, []);
  const {
    data,
    loading,
    error,
    headerMeta,
    applySnapshot,
    setData,
    refresh,
  } = useSignalSnapshot({
    limit: APP_CONFIG.signals.snapshotLimit,
    pollSeconds: POLL_SECONDS,
    errorMessage: '读取持仓数据失败',
    onSnapshot: preserveScrollAfterUpdate,
    pollEnabled: pollFallbackEnabled,
  });
  const { connected: streamConnected } = useSignalStream({
    limit: APP_CONFIG.signals.snapshotLimit,
    onSnapshot: (json) => applySnapshot(json, { resetCountdown: false }),
    onFallbackChange: setPollFallbackEnabled,
  });

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      const previous = window.history.scrollRestoration;
      window.history.scrollRestoration = 'manual';
      return () => {
        window.history.scrollRestoration = previous;
      };
    }
    return undefined;
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      lastScrollYRef.current = window.scrollY;
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  async function handleCopy(value, key) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? '' : current));
      }, 1200);
    } catch {
      setCopiedKey('');
    }
  }

  async function refreshVaultSnapshot() {
    const json = await fetchSignalSnapshot({
      limit: APP_CONFIG.signals.snapshotLimit,
      mode: 'realtime',
    });
    applySnapshot(json);
  }

  async function handleCloseRequest(payload, { confirmText, closingId = null, closeAll = false }) {
    if (!window.confirm(confirmText)) {
      return;
    }

    try {
      setCloseError('');
      if (closeAll) {
        setClosingAll(true);
      } else {
        setClosingPositionId(closingId);
      }

      const response = await fetch(withAppBasePath('/api/signals/positions/close'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || '平仓失败');
      }

      await refreshVaultSnapshot();
    } catch (requestError) {
      setCloseError(requestError instanceof Error ? requestError.message : '平仓失败');
    } finally {
      setClosingPositionId(null);
      setClosingAll(false);
    }
  }

  function handleStrategySaved(savedSettings) {
    setData((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        config: buildUpdatedConfig(current.config, buildPaperTradeSettings({ paperTradeSettings: savedSettings })),
      };
    });
  }

  function handleClosePosition(position) {
    void handleCloseRequest(
      { positionId: position.id },
      {
        confirmText: `确认立即平仓 ${position.symbol || position.name || '该持仓'}？`,
        closingId: position.id,
      }
    );
  }

  function handleCloseAllPositions() {
    void handleCloseRequest(
      { closeAll: true },
      {
        confirmText: `确认立即全部平仓？当前共有 ${paperPositions.length} 个未平仓持仓。`,
        closeAll: true,
      }
    );
  }

  const paperPositions = (data?.paperPositions || []).filter((position) => position.chain === selectedChain);
  const closedPaperPositions = (data?.closedPaperPositions || []).filter((position) => position.chain === selectedChain);
  const paperSummary = buildChainPaperSummary(data?.paperSummary, paperPositions, closedPaperPositions);
  const selectedChainLabel = getSelectedChainLabel(selectedChain);
  const hasOpenPositions = paperPositions.length > 0;
  const floatingPnlReady = !hasOpenPositions || Boolean(data?.liveUpdatedAt);
  const balancesReady = floatingPnlReady;
  const equityUsd = paperSummary?.equityUsd;
  const availableUsd = paperSummary?.availableUsd;
  const openPnLUsd = paperSummary?.openPnLUsd;
  const currentStrategy = buildPaperTradeSettings(data?.config);
  const takeProfitSummary = currentStrategy.takeProfitSteps.map((step, index) => ({
    key: `tp-${index + 1}`,
    label: `止盈${index + 1}`,
    value: `+${step.targetPercent}% / 卖${step.sellPercent}%`,
  }));
  const stopLossValue = currentStrategy.stopLossPercent > 0 ? `-${currentStrategy.stopLossPercent}%` : '--';
  const timeStopValue = currentStrategy.timeStopHours > 0 ? `${currentStrategy.timeStopHours}h` : '--';
  const openHeaderAside = (
    <div className="vault-policy-inline vault-policy-inline-dense">
      <div className="vault-policy-inline-main vault-policy-inline-main-dense vault-policy-inline-main-readable">
        {takeProfitSummary.length > 0 ? (
          <div className="vault-policy-group">
            {takeProfitSummary.map((item) => (
              <span key={item.key} className="vault-policy-chip vault-policy-chip-dense vault-policy-chip-wide">
                <strong>{item.label}</strong>
                <span>{item.value}</span>
              </span>
            ))}
          </div>
        ) : (
          <span className="vault-policy-chip vault-policy-chip-dense">止盈 --</span>
        )}
        <span className="vault-policy-chip vault-policy-chip-dense vault-policy-chip-risk">
          <strong>止损</strong>
          <span>{stopLossValue}</span>
        </span>
        <span className="vault-policy-chip vault-policy-chip-dense vault-policy-chip-time">
          <ClockIcon />
          <strong>时限</strong>
          <span>{timeStopValue}</span>
        </span>
      </div>
      <div className="vault-policy-actions">
        <StrategySettingsLauncher
          settings={currentStrategy}
          onSaved={handleStrategySaved}
          locked={hasOpenPositions}
          openPositionCount={paperPositions.length}
          variant="icon"
        />
        <div className="bulk-close-tooltip-wrap">
          <button
            type="button"
            className={`strategy-settings-icon-btn bulk-close-icon-btn ${closingAll ? 'active' : ''}`.trim()}
            onClick={handleCloseAllPositions}
            disabled={!hasOpenPositions || closingAll || closingPositionId != null}
            title={closingAll ? '全部平仓中...' : '全部平仓'}
            aria-label={closingAll ? '全部平仓中...' : '全部平仓'}
          >
            <PauseIcon />
          </button>
          <span className="bulk-close-tooltip-bubble" role="tooltip">
            <InfoTooltipIcon />
            <span>{closingAll ? '全部平仓中...' : '全部平仓'}</span>
          </span>
        </div>
      </div>
    </div>
  );


  return (
    <main className="page-shell">
      <AppHeader
        title="持仓信息"
        navKey="vault"
        statusCards={[
          {
            label: '网络', value: selectedChain, iconSrc: CHAIN_OPTIONS[0].iconSrc, iconAlt: '网络', options: CHAIN_OPTIONS,
            onChange: (chain) => { setSelectedChain(chain); refresh(); },
          },
          {
            label: '策略运行',
            value: headerMeta.strategyRuntimeLabel || formatDuration(headerMeta.strategyRuntimeSeconds ?? 0),
          },
          {
            label: '启动时间',
            value: headerMeta.strategyStartedAt ? formatTime(headerMeta.strategyStartedAt) : '--',
          },
          {
            label: '实时状态',
            value: streamConnected ? '已连接' : '连接中',
            tone: streamConnected ? 'positive' : 'warning',
          },
        ]}
      />

      <section className="stats-strip vault-stats-strip">
        <div className="stat-pill vault-stat-card">
          <div className="vault-stat-icon-wrap negative">
            <MetricBuyIcon />
          </div>
          <div className="vault-stat-copy">
            <span>买入总金额</span>
            <strong>{formatUsdValue(paperSummary.openCostUsd ?? 0)}</strong>
          </div>
        </div>
        <div className="stat-pill vault-stat-card">
          <div className="vault-stat-icon-wrap value">
            <MetricValueIcon />
          </div>
          <div className="vault-stat-copy">
            <span>当前总市值</span>
            <strong>{formatUsdValue(paperSummary.openValueUsd ?? 0)}</strong>
          </div>
        </div>
        <div className="stat-pill vault-stat-card">
          <div className="vault-stat-icon-wrap positive">
            <MetricPnlIcon />
          </div>
          <div className="vault-stat-copy">
            <span>浮动总盈亏</span>
            <strong className={(openPnLUsd ?? 0) >= 0 ? 'positive' : 'negative'}>
              {openPnLUsd != null ? formatUsd(openPnLUsd) : '--'}
            </strong>
          </div>
        </div>
      </section>

      {error ? <div className="panel error-state panel-gap" role="alert">{error}</div> : null}

      {!error ? (
        <section className="portfolio-grid">
          <PortfolioSection
            title="当前持仓"
            count={paperPositions.length}
            emptyHint={`${selectedChainLabel} 当前没有未平仓头寸`}
            metrics={[
              { label: '买入总金额', value: formatUsdValue(paperSummary.openCostUsd ?? 0) },
              { label: '当前总市值', value: formatUsdValue(paperSummary.openValueUsd ?? 0) },
              {
                label: '浮动总盈亏',
                value: openPnLUsd != null ? formatUsd(openPnLUsd) : '--',
                tone:
                  openPnLUsd == null
                    ? 'neutral'
                    : openPnLUsd >= 0
                      ? 'positive'
                      : 'negative',
              },
            ]}
            positions={paperPositions}
            loading={loading}
            copiedKey={copiedKey}
            onCopy={handleCopy}
            onClose={handleClosePosition}
            onCloseAll={handleCloseAllPositions}
            closeError={closeError}
            closingPositionId={closingPositionId}
            closingAll={closingAll}
            streamConnected={streamConnected}
            floatingPnlReady={floatingPnlReady}
            headerAside={openHeaderAside}
          />

          <PortfolioSection
            title="已平仓"
            count={closedPaperPositions.length}
            emptyText={`${selectedChainLabel} 当前没有已平仓记录。`}
            metrics={[
              { label: '累计买入', value: formatUsdValue(paperSummary.closedCostUsd ?? 0) },
              { label: '累计卖出', value: formatUsdValue(paperSummary.closedValueUsd ?? 0) },
              {
                label: '已实现总盈亏',
                value: formatUsd(paperSummary.closedPnLUsd ?? 0),
                tone: (paperSummary.closedPnLUsd ?? 0) >= 0 ? 'positive' : 'negative',
              },
            ]}
            positions={closedPaperPositions}
            type="closed"
            loading={loading}
            copiedKey={copiedKey}
            onCopy={handleCopy}
          />
        </section>
      ) : null}

      <AppFooter />
    </main>
  );
}
