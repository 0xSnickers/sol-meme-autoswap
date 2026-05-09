'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_CONFIG } from '../../src/config/app-config.js';
import { useSignalSnapshot } from '../../src/modules/signals/client/use-signal-snapshot.js';
import { useSignalStream } from '../../src/modules/signals/client/use-signal-stream.js';
import AppFooter from '../components/AppFooter';
import AppHeader from '../components/AppHeader';
import { PortfolioSection } from '../components/PortfolioCards';
import { formatDuration, formatTime, formatUsd, formatUsdValue } from '../components/formatters';

const POLL_SECONDS = APP_CONFIG.signals.pollSeconds;

function buildPaperTradeSettings(config = {}) {
  const fallbackTakeProfitSteps = Array.isArray(config?.paperTakeProfitSteps)
    ? config.paperTakeProfitSteps
    : [
        { targetPercent: 80, sellPercent: 55 },
        { targetPercent: 150, sellPercent: 25 },
        { targetPercent: 260, sellPercent: 20 },
      ];

  const settings = config?.paperTradeSettings || {};
  const takeProfitSteps =
    Array.isArray(settings.takeProfitSteps) && settings.takeProfitSteps.length > 0
      ? settings.takeProfitSteps
      : fallbackTakeProfitSteps;

  return {
    stopLossPercent: Number(settings.stopLossPercent ?? config.paperStopLossPercent ?? 50),
    trailingStartPercent: Number(settings.trailingStartPercent ?? config.paperTrailingStartPercent ?? 180),
    trailingStopPercent: Number(settings.trailingStopPercent ?? config.paperTrailingStopPercent ?? 35),
    timeStopHours: Number(settings.timeStopHours ?? config.paperTimeStopHours ?? 8),
    takeProfitSteps,
  };
}

export default function VaultPage() {
  const [copiedKey, setCopiedKey] = useState('');
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
    countdown,
    headerMeta,
    applySnapshot,
  } = useSignalSnapshot({
    limit: APP_CONFIG.signals.snapshotLimit,
    pollSeconds: POLL_SECONDS,
    errorMessage: '读取持仓数据失败',
    onSnapshot: preserveScrollAfterUpdate,
  });
  const { connected: streamConnected } = useSignalStream({
    limit: APP_CONFIG.signals.snapshotLimit,
    onSnapshot: (json) => applySnapshot(json, { resetCountdown: false }),
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

  const paperPositions = data?.paperPositions || [];
  const closedPaperPositions = data?.closedPaperPositions || [];
  const paperSummary = data?.paperSummary || null;
  const hasOpenPositions = paperPositions.length > 0;
  const floatingPnlReady = !hasOpenPositions || Boolean(data?.liveUpdatedAt);
  const balancesReady = floatingPnlReady;
  const equityUsd = paperSummary?.equityUsd;
  const availableUsd = paperSummary?.availableUsd;
  const openPnLUsd = paperSummary?.openPnLUsd;
  const currentStrategy = buildPaperTradeSettings(data?.config);
  const takeProfitSummary = currentStrategy.takeProfitSteps
    .map((step, index) => `TP${index + 1} +${step.targetPercent}%/${step.sellPercent}%`)
    .join(' · ');
  const takeProfitTriggers = currentStrategy.takeProfitSteps
    .map((step, index) => ({
      key: `tp-${index}`,
      label: `当涨幅 ≥ +${step.targetPercent}% → 卖出 ${step.sellPercent}%`,
    }))
    .filter((item) => Boolean(item.label));
  const stopLossTrigger =
    currentStrategy.stopLossPercent > 0 ? `当回撤 ≤ -${currentStrategy.stopLossPercent}% → 全平` : '未启用';
  const trailingTrigger =
    currentStrategy.trailingStartPercent > 0 && currentStrategy.trailingStopPercent > 0
      ? `当最高涨幅 ≥ +${currentStrategy.trailingStartPercent}% 启动；从高点回撤 ≥ ${currentStrategy.trailingStopPercent}% → 全平`
      : '未启用';
  const timeStopTrigger =
    currentStrategy.timeStopHours > 0 ? `持仓 ≥ ${currentStrategy.timeStopHours}h 且未到 TP1 → 全平` : '未启用';

  return (
    <main className="page-shell">
      <AppHeader
        title="持仓信息"
        navKey="vault"
        statusCards={[
          { label: '网络', value: 'Solana', iconSrc: '/chains/solana.jpg', iconAlt: 'Solana' },
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
          { label: '实时更新', value: { seconds: countdown, total: POLL_SECONDS } },
        ]}
      />

      <section className="stats-strip">
        <div className="stat-pill highlight">
          <div className="stat-label-row">
            <span>帐户余额</span>
            {!balancesReady ? <span className="stat-spinner" aria-label="loading" /> : null}
          </div>
          <div className="stat-value-row">
            <strong className={`${(paperSummary?.totalPnLUsd ?? 0) >= 0 ? 'positive' : 'negative'} nowrap-value`}>
              {equityUsd != null ? formatUsdValue(equityUsd) : '--'}
            </strong>
          </div>
        </div>
        <div className="stat-pill">
          <div className="stat-label-row">
            <span>可用余额</span>
            {!balancesReady ? <span className="stat-spinner" aria-label="loading" /> : null}
          </div>
          <div className="stat-value-row">
            <strong>{availableUsd != null ? formatUsdValue(availableUsd) : '--'}</strong>
          </div>
        </div>
        <div className="stat-pill">
          <div className="stat-label-row">
            <span>浮动盈亏</span>
            {!balancesReady ? <span className="stat-spinner" aria-label="loading" /> : null}
          </div>
          <div className="stat-value-row">
            <strong className={(openPnLUsd ?? 0) >= 0 ? 'positive' : 'negative'}>
              {openPnLUsd != null ? formatUsd(openPnLUsd) : '--'}
            </strong>
          </div>
        </div>
        <div className="stat-pill">
          <span>已实现盈亏</span>
          <strong className={(data?.paperSummary?.closedPnLUsd ?? 0) >= 0 ? 'positive' : 'negative'}>
            {formatUsd(data?.paperSummary?.closedPnLUsd ?? 0)}
          </strong>
        </div>
      </section>

      <section className="panel strategy-summary-panel compact-strategy-panel">
        <div className="panel-header compact-header">
          <div className="strategy-header">
            <div className="strategy-title-row">
              <h2>当前策略</h2>
              <span className="strategy-kicker">纸上交易 · 不加仓</span>
            </div>
            <p className="panel-subtitle">
              第 1 次信号满足门槛后直接开头仓；第 2 次信号仅在评分显著增强时允许开仓；一旦持仓中，后续信号只做观察与退出管理。
            </p>
          </div>
        </div>
        <div className="strategy-rule-grid">
          <div className="strategy-rule-card">
            <span className="strategy-rule-label">止盈触发</span>
            <strong className="strategy-rule-value">{takeProfitSummary || '--'}</strong>
            <div className="strategy-rule-lines">
              {takeProfitTriggers.map((item) => (
                <span key={item.key}>{item.label}</span>
              ))}
            </div>
          </div>
          <div className="strategy-rule-card">
            <span className="strategy-rule-label">止损触发</span>
            <strong className="strategy-rule-value">
              {currentStrategy.stopLossPercent > 0 ? `-${currentStrategy.stopLossPercent}%` : '--'}
            </strong>
            <div className="strategy-rule-lines">
              <span>{stopLossTrigger}</span>
            </div>
          </div>
          <div className="strategy-rule-card">
            <span className="strategy-rule-label">Trailing</span>
            <strong className="strategy-rule-value">
              +{currentStrategy.trailingStartPercent}% / 回撤 {currentStrategy.trailingStopPercent}%
            </strong>
            <div className="strategy-rule-lines">
              <span>{trailingTrigger}</span>
            </div>
          </div>
          <div className="strategy-rule-card">
            <span className="strategy-rule-label">时间退出</span>
            <strong className="strategy-rule-value">
              {currentStrategy.timeStopHours > 0 ? `${currentStrategy.timeStopHours}h` : '--'}
            </strong>
            <div className="strategy-rule-lines">
              <span>{timeStopTrigger}</span>
            </div>
          </div>
        </div>
      </section>

      {error ? <div className="panel error-state panel-gap">{error}</div> : null}

      {!error ? (
        <section className="portfolio-grid">
          <PortfolioSection
            title="当前持仓"
            count={paperPositions.length}
            emptyText="当前没有打开中的持仓。"
            metrics={[
              { label: '买入总金额', value: formatUsdValue(data?.paperSummary?.openCostUsd ?? 0) },
              { label: '当前总市值', value: formatUsdValue(data?.paperSummary?.openValueUsd ?? 0) },
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
            streamConnected={streamConnected}
            floatingPnlReady={floatingPnlReady}
          />

          <PortfolioSection
            title="已平仓"
            count={closedPaperPositions.length}
            emptyText="当前还没有已平仓记录。"
            metrics={[
              { label: '累计买入', value: formatUsdValue(data?.paperSummary?.closedCostUsd ?? 0) },
              { label: '累计卖出', value: formatUsdValue(data?.paperSummary?.closedValueUsd ?? 0) },
              {
                label: '已实现总盈亏',
                value: formatUsd(data?.paperSummary?.closedPnLUsd ?? 0),
                tone: (data?.paperSummary?.closedPnLUsd ?? 0) >= 0 ? 'positive' : 'negative',
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
