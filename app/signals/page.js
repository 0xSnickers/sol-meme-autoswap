'use client';

import { useEffect, useMemo, useState } from 'react';
import AppFooter from '../components/AppFooter';
import AppHeader from '../components/AppHeader';
import LoadingBlock from '../components/LoadingBlock';
import TokenSignalTimeline, { ScoreWithTooltip } from '../components/TokenSignalTimeline';
import VirtualListTable from '../components/VirtualListTable';
import { AddressCopy, ExternalLinks, TokenAvatar } from '../components/token-ui';

const REFRESH_SECONDS = 30;
const SIGNAL_ROW_HEIGHT = 278;
const SIGNAL_LIST_HEIGHT = 680;

function formatMoney(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '--';
  }

  return new Intl.NumberFormat('en-US', {
    notation: Number(value) >= 100000 ? 'compact' : 'standard',
    maximumFractionDigits: Number(value) >= 1000 ? 1 : 2,
  }).format(Number(value));
}

function formatPrice(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '--';
  }

  const number = Number(value);
  if (Math.abs(number) >= 1) {
    return `$${number.toFixed(4)}`;
  }
  if (Math.abs(number) >= 0.01) {
    return `$${number.toFixed(6)}`;
  }
  return `$${number.toFixed(8)}`;
}

function formatPercent(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '--';
  }

  const number = Number(value);
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
}

function formatTime(value) {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatCompactTime(value) {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDecisionLabel(value) {
  switch (value) {
    case 'approved':
      return '允许开仓';
    case 'skipped':
      return '已跳过';
    case 'rejected':
      return '未交易';
    default:
      return '--';
  }
}

function formatTradeActionLabel(alert) {
  const reason = String(alert?.tradeDecisionReason || '');
  if (reason.includes('第2次信号评分走强')) {
    return '补开头仓';
  }
  if (reason.includes('不再分批加仓') || reason.includes('头仓已一次性买满')) {
    return '持仓观察';
  }
  if (reason.includes('头仓条件')) {
    return '头仓';
  }
  if (reason.includes('头仓仅允许第 1-2 次')) {
    return '错过头仓窗口';
  }
  return alert?.tradeDecisionStatus === 'approved' ? '可执行' : '观察中';
}

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

function SortButton({ label, active, direction, onClick }) {
  return (
    <button type="button" className={`sort-chip ${active ? 'active' : ''}`} onClick={onClick}>
      <span>{label}</span>
      <strong>{active ? (direction === 'asc' ? '↑' : '↓') : '↕'}</strong>
    </button>
  );
}

export default function SignalsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(REFRESH_SECONDS);
  const [sortKey, setSortKey] = useState('latestPushedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [query, setQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const [headerMeta, setHeaderMeta] = useState({
    strategyRuntimeLabel: '',
    strategyStartedAt: '',
  });

  useEffect(() => {
    let disposed = false;

    async function loadSignals() {
      try {
        const response = await fetch('/api/signals/snapshot?limit=120', {
          cache: 'no-store',
        });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.error || '读取信号统计失败');
        }
        if (!disposed) {
          setData(json);
          setHeaderMeta((current) => ({
            strategyRuntimeLabel: json.strategyRuntimeLabel || current.strategyRuntimeLabel,
            strategyStartedAt: json.strategyStartedAt || current.strategyStartedAt,
          }));
          setError('');
          setLoading(false);
          setCountdown(REFRESH_SECONDS);
        }
      } catch (requestError) {
        if (!disposed) {
          setError(requestError instanceof Error ? requestError.message : '读取信号统计失败');
          setLoading(false);
        }
      }
    }

    void loadSignals();
    const refreshTimer = window.setInterval(() => {
      void loadSignals();
    }, REFRESH_SECONDS * 1000);
    const countdownTimer = window.setInterval(() => {
      setCountdown((current) => (current <= 1 ? REFRESH_SECONDS : current - 1));
    }, 1000);

    return () => {
      disposed = true;
      clearInterval(refreshTimer);
      clearInterval(countdownTimer);
    };
  }, []);

  const alerts = data?.alerts || [];
  const latestSignal = data?.latestSignal || alerts[0] || null;
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
      const haystack = [
        alert.address,
        alert.name,
        alert.symbol,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [query, sortedAlerts]);

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
        title="信号统计"
        navKey="intel"
        statusCards={[
          { label: '网络', value: 'Solana', iconSrc: '/chains/solana.jpg', iconAlt: 'Solana' },
          { label: '策略运行', value: headerMeta.strategyRuntimeLabel || '--' },
          { label: '启动时间', value: headerMeta.strategyStartedAt ? formatTime(headerMeta.strategyStartedAt) : '--' },
          { label: '实时状态', value: loading ? '连接中' : '已连接', tone: loading ? 'warning' : 'positive' },
          { label: '实时更新', value: { seconds: countdown, total: REFRESH_SECONDS } },
        ]}
      />

      <section className="panel stable-list-panel">
        <div className="panel-header compact-header">
          <div>
            <h2>信号列表</h2>
            <p className="panel-subtitle">列表展示的是已持久化的历史聚合信号，顶部卡片同步当前最新推送。</p>
          </div>
        </div>

        <div className="latest-signal-banner">
          <div>
            <span className="latest-signal-kicker">最新 Telegram 推送</span>
            <strong>
              {latestSignal ? `${latestSignal.name} (${latestSignal.symbol})` : '暂无最新信号'}
            </strong>
            <p>
              {latestSignal
                ? `${latestSignal.address} · ${formatTime(latestSignal.pushedAt)} · ${formatPercent(latestSignal.pctGain || 0)} · 评分 ${latestSignal.tradeScore ?? '--'}`
                : '等待下一次扫描结果'}
            </p>
          </div>
          <div className="latest-signal-meta">
            <span>{latestSignal?.smartMoney ?? '--'} 聪明钱</span>
            <span>买卖比 {latestSignal?.buySellRatio ?? '--'}</span>
            <span>流动性 {formatMoney(latestSignal?.liq || 0)}</span>
          </div>
        </div>

        <div className="signal-highlight-bar">
          <div className="signal-highlight-title">最新推送</div>
          <div className="signal-highlight-body">
            {latestSignal ? (
              <>
                <strong>{latestSignal.name} ({latestSignal.symbol})</strong>
                <span>{latestSignal.address}</span>
                <span>{formatCompactTime(latestSignal.pushedAt)}</span>
              </>
            ) : (
              <span>当前暂无最新推送</span>
            )}
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
            显示 {filteredAlerts.length} / {alerts.length}
          </div>
        </div>

        {loading ? (
          <div className="list-loading-wrap">
            <LoadingBlock title="Loading" description="正在加载信号列表..." />
          </div>
        ) : null}
        {error ? <div className="error-state">{error}</div> : null}
        {!loading && !error && filteredAlerts.length === 0 ? (
          <div className="empty-state">当前还没有可统计的推送信号。</div>
        ) : null}

        {filteredAlerts.length > 0 ? (
          <VirtualListTable
            items={filteredAlerts}
            rowHeight={SIGNAL_ROW_HEIGHT}
            height={SIGNAL_LIST_HEIGHT}
            headers={[
              { key: 'token', label: 'Token' },
              { key: 'signal', label: '信号' },
              { key: 'smart', label: '聪明钱' },
              { key: 'trade', label: '交易分数' },
              { key: 'status', label: '状态' },
              { key: 'market', label: '市场' },
              { key: 'timeline', label: '触发图表' },
              { key: 'time', label: '最近触发' },
            ]}
            headerClassName="signal-grid"
            rowClassName="signal-grid"
            minTableWidth={1360}
            getItemKey={(alert) => `${alert.chain}:${alert.address}`}
            renderRow={(alert) => {
              const copyId = `signal-${alert.address}`;
              return (
                <>
                  <div className="virtual-cell">
                    <div className="token-title-row">
                      <TokenAvatar name={alert.name} symbol={alert.symbol} imageUrl={alert.imageUrl} />
                      <strong>{alert.name}</strong>
                    </div>
                    <p>{alert.symbol}</p>
                    <AddressCopy
                      address={alert.address}
                      copyId={copyId}
                      copiedKey={copiedKey}
                      onCopy={handleCopy}
                    />
                    <div className="links-wrap compact-links">
                      <ExternalLinks
                        address={alert.address}
                        twitter={alert.twitter}
                        xOnly
                      />
                    </div>
                  </div>
                  <div className="virtual-cell">
                    <div className="timeline-summary-row">
                      <strong>{alert.occurrenceCount || alert.signalCount || 0} 次</strong>
                      <span className="timeline-mini-time">{formatCompactTime(alert.latestPushedAt || alert.pushedAt)}</span>
                    </div>
                    <p>现价 {formatPrice(alert.price)}</p>
                    <p>累计 {formatPercent(alert.pctGain || 0)}</p>
                  </div>
                  <div className="virtual-cell">
                    <strong>{alert.smartMoney || 0}</strong>
                    <p>持有人 {formatMoney(alert.holders || 0)}</p>
                  </div>
                  <div className="virtual-cell">
                    <ScoreWithTooltip score={alert.tradeScore ?? '--'} signal={alert} />
                    <p>{formatTradeActionLabel(alert)}</p>
                  </div>
                  <div className="virtual-cell">
                    <strong>{formatDecisionLabel(alert.tradeDecisionStatus)}</strong>
                    <p>
                      {alert.paperPositionStatus === 'open'
                        ? '当前持仓中'
                        : alert.paperPositionStatus === 'closed'
                          ? '已平仓'
                          : '未开仓'}
                    </p>
                    <p>
                      {alert.paperTargetPositionSizeUsd != null
                        ? formatEntryProgress(
                            alert.paperPositionSizeUsd,
                            alert.paperTargetPositionSizeUsd,
                            alert.paperEntryStage
                          )
                        : '--'}
                    </p>
                  </div>
                  <div className="virtual-cell">
                    <strong>流动性 ${formatMoney(alert.liq || 0)}</strong>
                    <p>1h量 ${formatMoney(alert.volume || 0)}</p>
                    <p>买卖比 {alert.buySellRatio ?? '--'}</p>
                  </div>
                  <div className="virtual-cell timeline-cell">
                    <TokenSignalTimeline history={alert.signalHistory || []} />
                  </div>
                  <div className="virtual-cell">
                    <strong>{formatTime(alert.latestPushedAt || alert.pushedAt)}</strong>
                    <p>首次 {formatTime(alert.firstPushedAt || alert.pushedAt)}</p>
                  </div>
                </>
              );
            }}
          />
        ) : null}
      </section>

      <AppFooter />
    </main>
  );
}
