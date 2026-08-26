'use client';

import { useMemo, useState } from 'react';
import { APP_CONFIG } from '../src/config/app-config.js';
import { useSignalSnapshot } from '../src/modules/signals/client/use-signal-snapshot.js';
import { useSignalStream } from '../src/modules/signals/client/use-signal-stream.js';
import {
  formatCompactTime,
  formatDuration,
  formatLiquidity,
  formatPercent,
  formatPrice,
  formatTime,
  formatUsd,
  formatUsdValue,
} from '../src/modules/signals/lib/signal-formatters.js';
import AppFooter from './components/AppFooter';
import AppHeader from './components/AppHeader';
import LoadingBlock from './components/LoadingBlock';
import { TradeDecisionIcon, TradeReasonIcon } from './components/TradeConditionsTooltip';
import TokenSignalTimeline from './components/TokenSignalTimeline';
import VirtualListTable from './components/VirtualListTable';
import { AddressCopy, ChainBadge, ExternalLinks, TokenAvatar } from './components/token-ui';
import { buildChainPaperSummary, CHAIN_OPTIONS, getSelectedChainLabel, useSelectedChain } from './components/useSelectedChain';

const POLL_SECONDS = APP_CONFIG.signals.pollSeconds;
const ALERT_ROW_HEIGHT = APP_CONFIG.ui.alertRowHeight;
const ALERT_LIST_HEIGHT = APP_CONFIG.ui.alertListHeight;

function formatEntryProgress(positionSizeUsd, targetPositionSizeUsd, entryStage) {
  const current = Number(positionSizeUsd || 0);
  const target = Number(targetPositionSizeUsd || 0);
  const stage = Number(entryStage || 0);
  if (target <= 0) {
    return '--';
  }

  const progress = Math.max(0, Math.min(100, (current / target) * 100));
  return `建仓 ${Math.min(stage || 0, 1)}/1 · ${progress.toFixed(0)}%`;
}

function AlertRow({
  alert,
  copiedKey,
  onCopy,
  streamConnected,
  rowIndex = 0,
  snapshotConfig,
}) {
  const copyId = `alert-${alert.address}-${alert.latestPushedAt || alert.pushedAt}`;
  const tradeScore = alert.tradeScore ?? '--';
  const priceScore = alert.priceScore ?? '--';

  return (
    <>
      <div className="virtual-cell token-cell">
        <div className="token-main token-main-compact">
          <div className="token-title-row position-token-topline token-title-row-compact">
            <TokenAvatar name={alert.name} symbol={alert.symbol} imageUrl={alert.imageUrl} />
            <div className="token-label-stack">
              <div className="token-title-inline">
                <strong className="token-symbol-primary">{alert.symbol}</strong>
                <ChainBadge chain={alert.chain} />
                <span className={`live-badge compact-live token-live-badge ${streamConnected ? 'connected' : 'disconnected'}`}>
                  <span className="live-dot" />
                  {streamConnected ? '实时' : '连接中'}
                </span>
                <ExternalLinks
                  address={alert.address}
                  chain={alert.chain}
                  twitter={alert.twitter}
                  xOnly
                />
              </div>
              <span className="token-name-secondary">{alert.name}</span>
            </div>
          </div>
          <div className="token-info-row token-info-row-compact">
            <span className="position-score-chip">现价 {formatPrice(alert.price)}</span>
            <div className="token-address-row">
              <AddressCopy
                address={alert.address}
                copyId={copyId}
                copiedKey={copiedKey}
                onCopy={onCopy}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="virtual-cell timeline-cell compact-timeline-cell">
        <div className="timeline-summary-row compact-summary-row">
          <strong>{alert.occurrenceCount || alert.signalCount} 次</strong>
          <span className="timeline-mini-time">{formatCompactTime(alert.latestPushedAt || alert.pushedAt)}</span>
        </div>
        <TokenSignalTimeline history={alert.signalHistory || []} compact />
      </div>
      <div className="virtual-cell momentum-cell compact-metric-cell">
        <div className="metric-stack compact-metric-stack">
          <div className="momentum-icon-row">
            <TradeReasonIcon signal={alert} preferBelow={rowIndex < 2} />
          </div>
          <strong className={alert.pctGain >= 0 ? 'positive' : 'negative'}>
            {formatPercent(alert.pctGain)}
          </strong>
          <span className="metric-inline">1h {formatPercent(alert.change1h || 0)}</span>
        </div>
      </div>
      <div className="virtual-cell trade-cell compact-trade-cell">
        <div className="trade-score-head">
          <div className="trade-icon-row">
            <TradeDecisionIcon
              signal={alert}
              snapshotConfig={snapshotConfig}
              preferBelow={rowIndex < 2}
            />
          </div>
          <div className="trade-score-compact">
            <span className="score-inline-pill muted trade-score-line">价格评分：{priceScore}</span>
            <span className="score-inline-pill trade-score-line">交易评分：{tradeScore}</span>
          </div>
        </div>
        <div className="trade-tags compact-tags">
          {alert.paperTargetPositionSizeUsd != null ? (
            <span className="history-chip">
              {formatEntryProgress(
                alert.paperPositionSizeUsd,
                alert.paperTargetPositionSizeUsd,
                alert.paperEntryStage
              )}
            </span>
          ) : null}
          {alert.paperPnLPct != null ? (
            <span className="history-chip">PnL {formatPercent(alert.paperPnLPct)}</span>
          ) : null}
        </div>
      </div>
      <div className="virtual-cell market-cell compact-market-cell">
        <div className="market-grid">
          <div className="market-pill">
            <span>聪明钱</span>
            <strong>{alert.smartMoney}</strong>
          </div>
          <div className="market-pill">
            <span>流动性</span>
            <strong>{formatLiquidity(alert.liq)}</strong>
          </div>
          <div className="market-pill">
            <span>1h量</span>
            <strong>{formatLiquidity(alert.volume)}</strong>
          </div>
          <div className="market-pill">
            <span>比值</span>
            <strong>{alert.buySellRatio}</strong>
          </div>
        </div>
      </div>
    </>
  );
}

function VirtualAlertList({ alerts, copiedKey, onCopy, streamConnected, snapshotConfig }) {
  return (
    <VirtualListTable
      items={alerts}
      rowHeight={ALERT_ROW_HEIGHT}
      height={ALERT_LIST_HEIGHT}
      headers={[
        { key: 'token', label: '代币' },
        { key: 'signal', label: '信号' },
        { key: 'momentum', label: '动量' },
        { key: 'trade', label: '交易' },
        { key: 'market', label: '市场' },
      ]}
      headerClassName="alert-grid alert-grid-centered"
      rowClassName="alert-grid"
      minTableWidth={980}
      getItemKey={(alert) => `${alert.address}-${alert.signalCount}-${alert.latestPushedAt || alert.pushedAt}`}
      renderRow={(alert, rowIndex) => (
        <AlertRow
          alert={alert}
          copiedKey={copiedKey}
          onCopy={onCopy}
          streamConnected={streamConnected}
          rowIndex={rowIndex}
          snapshotConfig={snapshotConfig}
        />
      )}
    />
  );
}

function SortButton({ label, active, direction, onClick }) {
  return (
    <button type="button" className={`sort-chip ${active ? 'active' : ''}`} onClick={onClick}>
      <span>{label}</span>
      <strong>{active ? (direction === 'asc' ? '↑' : '↓') : '↕'}</strong>
    </button>
  );
}

export default function Page() {
  const [selectedChain, setSelectedChain] = useSelectedChain();
  const [pollFallbackEnabled, setPollFallbackEnabled] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('latestPushedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const {
    data,
    error,
    loading,
    headerMeta,
    applySnapshot,
    refresh,
  } = useSignalSnapshot({
    limit: APP_CONFIG.signals.snapshotLimit,
    pollSeconds: POLL_SECONDS,
    errorMessage: '加载失败',
    pollEnabled: pollFallbackEnabled,
  });
  const { connected: streamConnected } = useSignalStream({
    limit: APP_CONFIG.signals.snapshotLimit,
    onSnapshot: (json) => applySnapshot(json, { resetCountdown: false }),
    onFallbackChange: setPollFallbackEnabled,
  });

  const alerts = useMemo(
    () => (data?.alerts || []).filter((alert) => alert.chain === selectedChain),
    [data?.alerts, selectedChain]
  );
  const chainOpenPositions = (data?.paperPositions || []).filter((position) => position.chain === selectedChain);
  const chainClosedPositions = (data?.closedPaperPositions || []).filter((position) => position.chain === selectedChain);
  const paperSummary = buildChainPaperSummary(data?.paperSummary, chainOpenPositions, chainClosedPositions);
  const selectedChainLabel = getSelectedChainLabel(selectedChain);
  const sortedAlerts = useMemo(() => {
    const rows = [...alerts];
    rows.sort((left, right) => {
      let leftValue;
      let rightValue;

      switch (sortKey) {
        case 'occurrenceCount':
          leftValue = left.occurrenceCount || left.signalCount || 0;
          rightValue = right.occurrenceCount || right.signalCount || 0;
          break;
        case 'smartMoney':
          leftValue = left.smartMoney || 0;
          rightValue = right.smartMoney || 0;
          break;
        case 'tradeScore':
          leftValue = left.tradeScore || 0;
          rightValue = right.tradeScore || 0;
          break;
        case 'pctGain':
          leftValue = left.pctGain || 0;
          rightValue = right.pctGain || 0;
          break;
        case 'volume':
          leftValue = left.volume || 0;
          rightValue = right.volume || 0;
          break;
        default:
          leftValue = new Date(left.latestPushedAt || left.pushedAt || 0).getTime();
          rightValue = new Date(right.latestPushedAt || right.pushedAt || 0).getTime();
          break;
      }

      if (leftValue === rightValue) {
        return (right.smartMoney || 0) - (left.smartMoney || 0);
      }

      return sortDirection === 'asc' ? leftValue - rightValue : rightValue - leftValue;
    });
    return rows;
  }, [alerts, sortDirection, sortKey]);
  const filteredAlerts = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return sortedAlerts;
    }

    return sortedAlerts.filter((alert) => {
      const haystack = [alert.address, alert.name, alert.symbol]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [query, sortedAlerts]);

  const hasOpenPositions = paperSummary.openCount > 0;
  const balancesReady = !hasOpenPositions || Boolean(data?.liveUpdatedAt);
  const equityUsd = paperSummary?.equityUsd;
  const availableUsd = paperSummary?.availableUsd;
  const openPnLUsd = paperSummary?.openPnLUsd;

  const miniStatusCards = [
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
  ];

  function handleSort(nextKey) {
    setSortKey((currentKey) => {
      if (currentKey === nextKey) {
        setSortDirection((currentDirection) => (currentDirection === 'desc' ? 'asc' : 'desc'));
        return currentKey;
      }

      setSortDirection('desc');
      return nextKey;
    });
  }

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

  return (
    <main className="page-shell">
      <AppHeader
        title="最新信号"
        navKey="pulse"
        statusCards={miniStatusCards}
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
          <span>打开持仓</span>
          <strong>{paperSummary.openCount}</strong>
        </div>
        <div className="stat-pill">
          <span>资金使用率</span>
          <strong>{Number(paperSummary.capitalUsagePct ?? 0).toFixed(1)}%</strong>
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
          <span>已实现</span>
          <strong className={(paperSummary.closedPnLUsd ?? 0) >= 0 ? 'positive' : 'negative'}>
            {formatUsd(paperSummary.closedPnLUsd ?? 0)}
          </strong>
        </div>
        <div className="stat-pill">
          <span>推送数</span>
          <strong>{alerts.length}</strong>
        </div>
      </section>

      <section className="panel stable-list-panel">
        <div className="panel-header compact-header">
          <div>
            <h2>推送列表</h2>
          </div>
        </div>

        <div className="sort-toolbar">
          <SortButton
            label="最近触发"
            active={sortKey === 'latestPushedAt'}
            direction={sortDirection}
            onClick={() => handleSort('latestPushedAt')}
          />
          <SortButton
            label="信号次数"
            active={sortKey === 'occurrenceCount'}
            direction={sortDirection}
            onClick={() => handleSort('occurrenceCount')}
          />
          <SortButton
            label="聪明钱"
            active={sortKey === 'smartMoney'}
            direction={sortDirection}
            onClick={() => handleSort('smartMoney')}
          />
          <SortButton
            label="交易分数"
            active={sortKey === 'tradeScore'}
            direction={sortDirection}
            onClick={() => handleSort('tradeScore')}
          />
          <SortButton
            label="累计涨幅"
            active={sortKey === 'pctGain'}
            direction={sortDirection}
            onClick={() => handleSort('pctGain')}
          />
          <SortButton
            label="成交量"
            active={sortKey === 'volume'}
            direction={sortDirection}
            onClick={() => handleSort('volume')}
          />
        </div>

        <div className="search-toolbar">
          <input
            type="text"
            className="search-input"
            placeholder="搜索 CA / Token 名称 / Symbol"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="search-summary">
            显示 {filteredAlerts.length} / {sortedAlerts.length}
          </div>
        </div>

        {loading ? (
          <div className="list-loading-wrap">
            <LoadingBlock
              title={data ? '正在刷新' : '正在加载'}
              description={data ? '正在同步当前网络的最新推送...' : '正在加载推送列表...'}
              compact={Boolean(data)}
            />
          </div>
        ) : null}
        {error ? <div className="error-state" role="alert">{error}</div> : null}
        {!loading && !error && filteredAlerts.length === 0 ? (
          <div className="empty-state">
            {selectedChainLabel} 暂无已保存的推送记录
            {data?.scannedAt ? `，全部网络最近扫描于 ${formatTime(data.scannedAt)}` : '，扫描服务尚未产生数据'}。
          </div>
        ) : null}

        {filteredAlerts.length > 0 ? (
          <VirtualAlertList
            alerts={filteredAlerts}
            copiedKey={copiedKey}
            onCopy={handleCopy}
            streamConnected={streamConnected}
            snapshotConfig={data?.config}
          />
        ) : null}
      </section>

      <AppFooter />
    </main>
  );
}
