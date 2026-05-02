'use client';

import { useEffect, useMemo, useState } from 'react';
import AppFooter from './components/AppFooter';
import AppHeader from './components/AppHeader';
import LoadingBlock from './components/LoadingBlock';
import VirtualListTable from './components/VirtualListTable';
import { AddressCopy, ExternalLinks } from './components/token-ui';

const POLL_SECONDS = 30;
const MAX_HISTORY_ITEMS = 3;
const ALERT_ROW_HEIGHT = 152;
const ALERT_LIST_HEIGHT = 620;

function formatMoney(value) {
  if (value == null) {
    return '--';
  }

  return new Intl.NumberFormat('en-US', {
    notation: value >= 100000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1000 ? 1 : 2,
  }).format(value);
}

function formatPercent(value) {
  if (value == null) {
    return '--';
  }

  const number = Number(value);
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
}

function formatPrice(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '--';
  }

  const number = Number(value);
  const abs = Math.abs(number);
  if (abs >= 1) {
    return `$${number.toFixed(4)}`;
  }
  if (abs >= 0.01) {
    return `$${number.toFixed(6)}`;
  }
  return `$${number.toFixed(8)}`;
}

function formatUsd(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '--';
  }

  const number = Number(value);
  return `${number >= 0 ? '+' : '-'}$${Math.abs(number).toFixed(2)}`;
}

function formatUsdValue(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '--';
  }

  return `$${Math.abs(Number(value)).toFixed(2)}`;
}

function formatTime(value) {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) {
    return '刚启动';
  }

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

function formatDecisionLabel(value) {
  switch (value) {
    case 'approved':
      return '允许开仓';
    case 'skipped':
      return '跳过';
    case 'rejected':
      return '不交易';
    default:
      return '--';
  }
}

function AlertRow({ alert, copiedKey, onCopy, liveUpdatedAt, streamConnected }) {
  const copyId = `alert-${alert.address}-${alert.latestPushedAt || alert.pushedAt}`;

  return (
    <>
      <div className="virtual-cell">
        <div className="token-main">
          <strong>{alert.name}</strong>
          <p>{alert.symbol} · {alert.ageHours}h</p>
          <div className="live-row">
            <span className={`live-badge compact-live ${streamConnected ? 'connected' : 'disconnected'}`}>
              <span className="live-dot" />
              {streamConnected ? '实时' : '连接中'}
            </span>
            <span className="live-time">更新 {formatTime(liveUpdatedAt)}</span>
          </div>
          <AddressCopy
            address={alert.address}
            copyId={copyId}
            copiedKey={copiedKey}
            onCopy={onCopy}
          />
          <p className="token-subtle">现价 {formatPrice(alert.price)}</p>
        </div>
      </div>
      <div className="virtual-cell">
        <strong>累计 {alert.occurrenceCount || alert.signalCount} 次</strong>
        <p>最近: {formatTime(alert.latestPushedAt || alert.pushedAt)}</p>
        <div className="history-list">
          {(alert.signalHistory || []).slice(0, MAX_HISTORY_ITEMS).map((item) => (
            <span key={`${alert.address}-${item.signalCount}-${item.pushedAt}`} className="history-chip">
              #{item.signalCount} {formatTime(item.pushedAt)} · {formatPrice(item.price)}
            </span>
          ))}
          {(alert.signalHistory || []).length > MAX_HISTORY_ITEMS ? (
            <span className="history-chip muted-chip">
              +{alert.signalHistory.length - MAX_HISTORY_ITEMS}
            </span>
          ) : null}
        </div>
      </div>
      <div className="virtual-cell">
        <span className="status status-triggered">已触发</span>
        <p className={alert.pctGain >= 0 ? 'positive' : 'negative'}>{formatPercent(alert.pctGain)}</p>
        <p>{formatPercent(alert.change1h || 0)} / 1h</p>
      </div>
      <div className="virtual-cell">
        <strong>{alert.tradeScore ?? '--'} 分</strong>
        <p>{formatDecisionLabel(alert.tradeDecisionStatus)}</p>
        <div className="trade-tags">
          {alert.paperPnLPct != null ? (
            <span className="history-chip">PnL {formatPercent(alert.paperPnLPct)}</span>
          ) : null}
          <span className="history-chip">TP +{alert.paperTakeProfitPct ?? 20}%</span>
          <span className="history-chip">SL -{alert.paperStopLossPct ?? 50}%</span>
        </div>
      </div>
      <div className="virtual-cell">
        <strong>聪明钱 {alert.smartMoney}</strong>
        <p>流动性 ${formatMoney(alert.liq)}</p>
        <p>1h量 ${formatMoney(alert.volume)} / 比值 {alert.buySellRatio}</p>
      </div>
      <div className="virtual-cell">
        <ExternalLinks
          address={alert.address}
          twitter={alert.twitter}
          website={alert.website}
          telegram={alert.telegram}
        />
      </div>
    </>
  );
}

function VirtualAlertList({ alerts, copiedKey, onCopy, liveUpdatedAt, streamConnected }) {
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
        { key: 'links', label: '链接' },
      ]}
      headerClassName="alert-grid"
      rowClassName="alert-grid"
      minTableWidth={980}
      getItemKey={(alert) => `${alert.address}-${alert.signalCount}-${alert.latestPushedAt || alert.pushedAt}`}
      renderRow={(alert) => (
        <AlertRow
          alert={alert}
          copiedKey={copiedKey}
          onCopy={onCopy}
          liveUpdatedAt={liveUpdatedAt}
          streamConnected={streamConnected}
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
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(POLL_SECONDS);
  const [copiedKey, setCopiedKey] = useState('');
  const [streamConnected, setStreamConnected] = useState(false);
  const [sortKey, setSortKey] = useState('latestPushedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [headerMeta, setHeaderMeta] = useState({
    strategyRuntimeLabel: '',
    strategyRuntimeSeconds: 0,
    strategyStartedAt: '',
  });

  useEffect(() => {
    let disposed = false;

    async function load() {
      try {
        setError('');
        const response = await fetch('/api/radar/scan?limit=200', {
          cache: 'no-store',
        });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error || '加载失败');
        }

        if (!disposed) {
          setData(json);
          setHeaderMeta((current) => ({
            strategyRuntimeLabel: json.strategyRuntimeLabel || current.strategyRuntimeLabel,
            strategyRuntimeSeconds: json.strategyRuntimeSeconds ?? current.strategyRuntimeSeconds,
            strategyStartedAt: json.strategyStartedAt || current.strategyStartedAt,
          }));
          setLoading(false);
          setCountdown(POLL_SECONDS);
        }
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : '加载失败');
          setLoading(false);
        }
      }
    }

    load();
    const pollTimer = setInterval(load, POLL_SECONDS * 1000);
    const countdownTimer = setInterval(() => {
      setCountdown((value) => (value <= 1 ? POLL_SECONDS : value - 1));
    }, 1000);

    return () => {
      disposed = true;
      clearInterval(pollTimer);
      clearInterval(countdownTimer);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const source = new EventSource('/api/radar/stream?limit=200');

    source.addEventListener('snapshot', (event) => {
      if (disposed) {
        return;
      }

      try {
        const json = JSON.parse(event.data);
        setData(json);
        setHeaderMeta((current) => ({
          strategyRuntimeLabel: json.strategyRuntimeLabel || current.strategyRuntimeLabel,
          strategyRuntimeSeconds: json.strategyRuntimeSeconds ?? current.strategyRuntimeSeconds,
          strategyStartedAt: json.strategyStartedAt || current.strategyStartedAt,
        }));
        setStreamConnected(true);
        setLoading(false);
      } catch {
        setStreamConnected(false);
      }
    });

    source.addEventListener('stream-error', () => {
      if (!disposed) {
        setStreamConnected(false);
      }
    });

    source.onerror = () => {
      if (!disposed) {
        setStreamConnected(false);
      }
    };

    return () => {
      disposed = true;
      source.close();
    };
  }, []);

  const alerts = data?.alerts || [];
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

  const miniStatusCards = [
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
    {
      label: '实时更新',
      value: { seconds: countdown, total: POLL_SECONDS },
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
      <AppHeader title="最新信号" navKey="pulse" statusCards={miniStatusCards} />

      <section className="stats-strip">
        <div className="stat-pill highlight">
          <span>账户权益</span>
          <strong className={(data?.paperSummary?.totalPnLUsd ?? 0) >= 0 ? 'positive' : 'negative nowrap-value'}>
            {formatUsdValue(data?.paperSummary?.equityUsd ?? 0)}
          </strong>
        </div>
        <div className="stat-pill">
          <span>可用余额</span>
          <strong>{formatUsdValue(data?.paperSummary?.availableUsd ?? 0)}</strong>
        </div>
        <div className="stat-pill">
          <span>打开持仓</span>
          <strong>{data?.paperSummary?.openCount ?? 0}</strong>
        </div>
        <div className="stat-pill">
          <span>资金使用率</span>
          <strong>{Number(data?.paperSummary?.capitalUsagePct ?? 0).toFixed(1)}%</strong>
        </div>
        <div className="stat-pill">
          <span>浮动盈亏</span>
          <strong className={(data?.paperSummary?.openPnLUsd ?? 0) >= 0 ? 'positive' : 'negative'}>
            {formatUsd(data?.paperSummary?.openPnLUsd ?? 0)}
          </strong>
        </div>
        <div className="stat-pill">
          <span>已实现</span>
          <strong className={(data?.paperSummary?.closedPnLUsd ?? 0) >= 0 ? 'positive' : 'negative'}>
            {formatUsd(data?.paperSummary?.closedPnLUsd ?? 0)}
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

        {loading ? (
          <div className="list-loading-wrap">
            <LoadingBlock title="Loading" description="正在加载推送列表..." />
          </div>
        ) : null}
        {error ? <div className="error-state">{error}</div> : null}
        {!loading && !error && sortedAlerts.length === 0 ? (
          <div className="empty-state">当前没有新的推送结果，等待下一轮扫描。</div>
        ) : null}

        {sortedAlerts.length > 0 ? (
          <VirtualAlertList
            alerts={sortedAlerts}
            copiedKey={copiedKey}
            onCopy={handleCopy}
            liveUpdatedAt={data?.liveUpdatedAt}
            streamConnected={streamConnected}
          />
        ) : null}
      </section>

      <AppFooter />
    </main>
  );
}
