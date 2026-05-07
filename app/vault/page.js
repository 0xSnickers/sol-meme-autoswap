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
    onSnapshot: applySnapshot,
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
  const hasOpenPositions = paperPositions.length > 0;
  const floatingPnlReady = !hasOpenPositions || Boolean(data?.liveUpdatedAt);
  const currentStrategy = buildPaperTradeSettings(data?.config);
  const takeProfitSummary = currentStrategy.takeProfitSteps
    .map((step, index) => `TP${index + 1} +${step.targetPercent}%/${step.sellPercent}%`)
    .join(' · ');

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
          <span>帐户余额</span>
          <strong className={(data?.paperSummary?.totalPnLUsd ?? 0) >= 0 ? 'positive' : 'negative nowrap-value'}>
            {formatUsdValue(data?.paperSummary?.equityUsd ?? 0)}
          </strong>
        </div>
        <div className="stat-pill">
          <span>可用余额</span>
          <strong>{formatUsdValue(data?.paperSummary?.availableUsd ?? 0)}</strong>
        </div>
        <div className="stat-pill">
          <span>浮动盈亏</span>
          <strong
            className={
              floatingPnlReady
                ? (data?.paperSummary?.openPnLUsd ?? 0) >= 0
                  ? 'positive'
                  : 'negative'
                : ''
            }
          >
            {floatingPnlReady ? formatUsd(data?.paperSummary?.openPnLUsd ?? 0) : '--'}
          </strong>
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
          <div>
            <h2>当前策略</h2>
            <p className="panel-subtitle">
              第 1 次信号满足评分和质量门槛时直接买入目标仓位 100%；第 2 次信号只有在评分明显强于上次时才允许补开头仓；
              一旦已有持仓，后续信号只做观察与风控，不再追加买入。
            </p>
          </div>
        </div>
        <div className="strategy-pill-row">
          <span className="strategy-pill">{takeProfitSummary || '止盈规则 --'}</span>
          <span className="strategy-pill">止损 {currentStrategy.stopLossPercent > 0 ? `-${currentStrategy.stopLossPercent}%` : '--'}</span>
          <span className="strategy-pill">
            移动止盈 +{currentStrategy.trailingStartPercent}% / 回撤 {currentStrategy.trailingStopPercent}%
          </span>
          <span className="strategy-pill">{currentStrategy.timeStopHours}h 未到 TP1 退出</span>
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
                value: floatingPnlReady ? formatUsd(data?.paperSummary?.openPnLUsd ?? 0) : '--',
                tone: floatingPnlReady
                  ? (data?.paperSummary?.openPnLUsd ?? 0) >= 0
                    ? 'positive'
                    : 'negative'
                  : 'neutral',
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
