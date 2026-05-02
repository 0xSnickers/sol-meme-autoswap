'use client';

import { useEffect, useMemo, useState } from 'react';

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

function formatXLabel(url) {
  if (!url) {
    return 'X';
  }

  try {
    const { pathname } = new URL(url);
    const clean = pathname.replace(/^\/+/, '');
    return clean ? `X/${clean}` : 'X';
  } catch {
    return 'X';
  }
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

function formatAddress(value) {
  if (!value) {
    return '--';
  }
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function formatTokenAmount(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '--';
  }

  return new Intl.NumberFormat('en-US', {
    notation: value >= 100000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1000 ? 2 : 4,
  }).format(Number(value));
}

function LinkIcon({ kind }) {
  switch (kind) {
    case 'x':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M18.9 2H22l-6.77 7.74L23 22h-6.1l-4.78-6.26L6.64 22H3.53l7.24-8.27L1 2h6.25l4.32 5.7L18.9 2Zm-1.07 18h1.69L6.33 3.9H4.52Z"
          />
        </svg>
      );
    case 'telegram':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M9.78 15.42 9.4 20.8c.54 0 .78-.23 1.06-.51l2.54-2.42 5.27 3.86c.97.53 1.65.25 1.91-.89l3.46-16.2h.01c.31-1.45-.52-2.01-1.47-1.66L2.03 10.74c-1.38.54-1.36 1.31-.24 1.66l5.15 1.6L18.9 6.5c.56-.34 1.07-.15.65.2"
          />
        </svg>
      );
    case 'website':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.93 9h-3.11a15.5 15.5 0 0 0-1.38-5.02A8.03 8.03 0 0 1 18.93 11ZM12 4.04c.82 1.12 1.9 3.48 2.21 6.96H9.79C10.1 7.52 11.18 5.16 12 4.04ZM4.06 13h3.11c.16 1.83.64 3.56 1.37 5.02A8.03 8.03 0 0 1 4.06 13Zm3.11-2H4.06a8.03 8.03 0 0 1 4.48-5.02A15.5 15.5 0 0 0 7.17 11Zm4.83 8.96c-.82-1.12-1.9-3.48-2.21-6.96h4.42c-.31 3.48-1.39 5.84-2.21 6.96ZM14.83 13h3.11a8.03 8.03 0 0 1-4.48 5.02A15.5 15.5 0 0 0 14.83 13Z"
          />
        </svg>
      );
    case 'gmgn':
      return <span className="link-letter">G</span>;
    case 'dex':
      return <span className="link-letter">D</span>;
    default:
      return <span className="link-letter">?</span>;
  }
}

function AddressCopy({ address, copyId, copiedKey, onCopy }) {
  return (
    <div className="ca-row">
      <span className="ca-text">{formatAddress(address)}</span>
      <button type="button" className="copy-btn" onClick={() => onCopy(address, copyId)}>
        {copiedKey === copyId ? '已复制' : '复制'}
      </button>
    </div>
  );
}

function ExternalLinks({ address, twitter, website, telegram }) {
  return (
    <div className="icon-links">
      {twitter ? (
        <a
          href={twitter}
          target="_blank"
          rel="noreferrer"
          className="icon-link"
          title={formatXLabel(twitter)}
          aria-label="X"
        >
          <LinkIcon kind="x" />
        </a>
      ) : null}
      {website ? (
        <a
          href={website}
          target="_blank"
          rel="noreferrer"
          className="icon-link"
          title="官网"
          aria-label="官网"
        >
          <LinkIcon kind="website" />
        </a>
      ) : null}
      {telegram ? (
        <a
          href={telegram}
          target="_blank"
          rel="noreferrer"
          className="icon-link"
          title="Telegram"
          aria-label="Telegram"
        >
          <LinkIcon kind="telegram" />
        </a>
      ) : null}
      <a
        href={`https://gmgn.ai/sol/token/${address}`}
        target="_blank"
        rel="noreferrer"
        className="icon-link"
        title="GMGN"
        aria-label="GMGN"
      >
        <LinkIcon kind="gmgn" />
      </a>
      <a
        href={`https://dexscreener.com/solana/${address}`}
        target="_blank"
        rel="noreferrer"
        className="icon-link"
        title="Dexscreener"
        aria-label="Dexscreener"
      >
        <LinkIcon kind="dex" />
      </a>
    </div>
  );
}

function SummaryMetric({ label, value, tone = 'neutral' }) {
  return (
    <div className="summary-metric">
      <span>{label}</span>
      <strong className={tone === 'positive' ? 'positive' : tone === 'negative' ? 'negative' : ''}>
        {value}
      </strong>
    </div>
  );
}

function PaperPositionCard({
  position,
  type = 'open',
  copiedKey,
  onCopy,
  streamConnected = false,
  liveUpdatedAt,
}) {
  const isClosed = type === 'closed';
  const copyId = `${type}-${position.id}`;
  const valueLabel = isClosed ? '卖出金额' : '当前市值';
  const valueAmount = position.currentValueUsd;
  const valuePrice = position.closePrice || position.currentPrice;

  return (
    <article className="position-card">
      <div className="position-card-top">
        <div className="token-main">
          <strong>{position.name}</strong>
          <p>{position.symbol}</p>
          {!isClosed ? (
            <div className="live-row">
              <span className={`live-badge ${streamConnected ? 'connected' : 'disconnected'}`}>
                <span className="live-dot" />
                {streamConnected ? '实时跟踪中' : '实时重连中'}
              </span>
              <span className="live-time">更新 {formatTime(liveUpdatedAt)}</span>
            </div>
          ) : null}
          <AddressCopy
            address={position.address}
            copyId={copyId}
            copiedKey={copiedKey}
            onCopy={onCopy}
          />
        </div>
        <div className="position-pnl">
          <strong className={(position.pnlUsd ?? 0) >= 0 ? 'positive' : 'negative'}>
            {formatUsd(position.pnlUsd)}
          </strong>
          <p className={(position.pnlPct ?? 0) >= 0 ? 'positive' : 'negative'}>
            {formatPercent(position.pnlPct)}
          </p>
        </div>
      </div>

      <div className="position-metrics">
        <div className="position-metric">
          <span>买入金额</span>
          <strong>{formatUsdValue(position.positionSizeUsd)}</strong>
        </div>
        <div className="position-metric">
          <span>{valueLabel}</span>
          <strong>{formatUsdValue(valueAmount)}</strong>
        </div>
        <div className="position-metric">
          <span>买入价格</span>
          <strong>{formatPrice(position.entryPrice)}</strong>
        </div>
        <div className="position-metric">
          <span>{isClosed ? '卖出价格' : '当前价格'}</span>
          <strong>{formatPrice(valuePrice)}</strong>
        </div>
        <div className="position-metric">
          <span>买入数量</span>
          <strong>{formatTokenAmount(position.tokenAmount)}</strong>
        </div>
        <div className="position-metric">
          <span>信号 / 评分</span>
          <strong>
            #{position.entrySignalCount} / {position.tradeScore ?? '--'}
          </strong>
        </div>
      </div>

      <div className="position-card-footer">
        <div className="position-card-meta">
          <span>{isClosed ? `开仓 ${formatTime(position.openedAt)}` : `开仓时间 ${formatTime(position.openedAt)}`}</span>
          <span>{isClosed ? `平仓 ${formatTime(position.closedAt)}` : `TP +${position.takeProfitPct}% / SL -${position.stopLossPct}%`}</span>
          <span>{isClosed ? `原因 ${position.closeReason || '--'}` : `聪明钱 ${position.smartMoney ?? '--'} / 买卖比 ${position.buySellRatio ?? '--'}`}</span>
        </div>
        <ExternalLinks address={position.address} />
      </div>
    </article>
  );
}

function AlertRow({ alert, copiedKey, onCopy, liveUpdatedAt, streamConnected }) {
  const copyId = `alert-${alert.address}-${alert.latestPushedAt || alert.pushedAt}`;

  return (
    <div className="virtual-row-inner alert-grid">
      <div className="virtual-cell">
        <div className="token-main">
          <strong>{alert.name}</strong>
          <p>{alert.symbol} · {alert.ageHours}h</p>
          <div className="live-row">
            <span className={`live-badge compact-live ${streamConnected ? 'connected' : 'disconnected'}`}>
              <span className="live-dot" />
              {streamConnected ? '实时' : '重连'}
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
    </div>
  );
}

function VirtualAlertList({ alerts, copiedKey, onCopy, liveUpdatedAt, streamConnected }) {
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    setScrollTop(0);
  }, [alerts.length]);

  const { startIndex, endIndex, visibleAlerts, totalHeight } = useMemo(() => {
    const overscan = 4;
    const start = Math.max(0, Math.floor(scrollTop / ALERT_ROW_HEIGHT) - overscan);
    const visibleCount = Math.ceil(ALERT_LIST_HEIGHT / ALERT_ROW_HEIGHT) + overscan * 2;
    const end = Math.min(alerts.length, start + visibleCount);
    return {
      startIndex: start,
      endIndex: end,
      visibleAlerts: alerts.slice(start, end),
      totalHeight: alerts.length * ALERT_ROW_HEIGHT,
    };
  }, [alerts, scrollTop]);

  return (
    <div className="virtual-shell">
      <div className="virtual-table">
        <div className="virtual-header alert-grid">
          <div className="virtual-head-cell">代币</div>
          <div className="virtual-head-cell">信号</div>
          <div className="virtual-head-cell">动量</div>
          <div className="virtual-head-cell">交易</div>
          <div className="virtual-head-cell">市场</div>
          <div className="virtual-head-cell">链接</div>
        </div>
        <div className="virtual-viewport" onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
          <div className="virtual-spacer" style={{ height: totalHeight }}>
            {visibleAlerts.map((alert, index) => {
              const actualIndex = startIndex + index;
              return (
                <div
                  key={`${alert.address}-${alert.signalCount}-${alert.latestPushedAt || alert.pushedAt}`}
                  className="virtual-row"
                  style={{ transform: `translateY(${actualIndex * ALERT_ROW_HEIGHT}px)` }}
                >
                  <AlertRow
                    alert={alert}
                    copiedKey={copiedKey}
                    onCopy={onCopy}
                    liveUpdatedAt={liveUpdatedAt}
                    streamConnected={streamConnected}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div className="virtual-footer">
          显示 {alerts.length === 0 ? 0 : startIndex + 1}-{endIndex} / {alerts.length}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(POLL_SECONDS);
  const [copiedKey, setCopiedKey] = useState('');
  const [streamConnected, setStreamConnected] = useState(false);

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
  const paperPositions = data?.paperPositions || [];
  const closedPaperPositions = data?.closedPaperPositions || [];

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
      <section className="topbar">
        <div>
          <p className="eyebrow">GMGN SOL MEME RADAR</p>
          <h1>信号与纸上交易面板</h1>
        </div>
        <div className="topbar-meta">
          <span>SOL</span>
          <span>策略已运行 {data?.strategyRuntimeLabel || formatDuration(data?.strategyRuntimeSeconds ?? 0)}</span>
          <span>{data?.strategyStartedAt ? `启动 ${formatTime(data.strategyStartedAt)}` : '启动 --'}</span>
          <span>{streamConnected ? '实时已连接' : '实时重连中'}</span>
          <span>{countdown}s 全量补扫</span>
          <span>{data?.liveUpdatedAt ? `实时 ${new Date(data.liveUpdatedAt).toLocaleTimeString()}` : '--'}</span>
          <span>{data?.scannedAt ? `扫描 ${new Date(data.scannedAt).toLocaleTimeString()}` : '--'}</span>
        </div>
      </section>

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

      <section className="portfolio-grid">
        <div className="panel portfolio-panel">
          <div className="panel-header compact-header">
            <div>
              <h2>持仓中</h2>
              <p>当前打开中的纸上持仓，集中看买入金额、当前市值和浮动盈亏</p>
            </div>
          </div>
          <div className="summary-metrics">
            <SummaryMetric label="买入总金额" value={formatUsdValue(data?.paperSummary?.openCostUsd ?? 0)} />
            <SummaryMetric label="当前总市值" value={formatUsdValue(data?.paperSummary?.openValueUsd ?? 0)} />
            <SummaryMetric
              label="浮动总盈亏"
              value={formatUsd(data?.paperSummary?.openPnLUsd ?? 0)}
              tone={(data?.paperSummary?.openPnLUsd ?? 0) >= 0 ? 'positive' : 'negative'}
            />
          </div>

          {!loading && !error && paperPositions.length === 0 ? (
            <div className="empty-state compact-empty">当前没有打开中的持仓。</div>
          ) : null}

          {paperPositions.length > 0 ? (
            <div className="position-card-list">
              {paperPositions.map((position) => (
                <PaperPositionCard
                  key={`position-${position.id}`}
                  position={position}
                  copiedKey={copiedKey}
                  onCopy={handleCopy}
                  streamConnected={streamConnected}
                  liveUpdatedAt={data?.liveUpdatedAt}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="panel portfolio-panel">
          <div className="panel-header compact-header">
            <div>
              <h2>已平仓</h2>
              <p>保留最终卖出结果，方便复盘累计买入、累计卖出和已实现盈亏</p>
            </div>
          </div>
          <div className="summary-metrics">
            <SummaryMetric label="累计买入" value={formatUsdValue(data?.paperSummary?.closedCostUsd ?? 0)} />
            <SummaryMetric label="累计卖出" value={formatUsdValue(data?.paperSummary?.closedValueUsd ?? 0)} />
            <SummaryMetric
              label="已实现总盈亏"
              value={formatUsd(data?.paperSummary?.closedPnLUsd ?? 0)}
              tone={(data?.paperSummary?.closedPnLUsd ?? 0) >= 0 ? 'positive' : 'negative'}
            />
          </div>

          {!loading && !error && closedPaperPositions.length === 0 ? (
            <div className="empty-state compact-empty">当前还没有已平仓记录。</div>
          ) : null}

          {closedPaperPositions.length > 0 ? (
            <div className="position-card-list">
              {closedPaperPositions.map((position) => (
                <PaperPositionCard
                  key={`closed-${position.id}`}
                  position={position}
                  type="closed"
                  copiedKey={copiedKey}
                  onCopy={handleCopy}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header compact-header">
          <div>
            <h2>推送 Token</h2>
            <p>固定高度虚拟列表，仅渲染可视区域，避免数据量大时页面卡顿</p>
          </div>
        </div>

        {loading ? <div className="empty-state">正在加载扫描结果...</div> : null}
        {error ? <div className="error-state">{error}</div> : null}
        {!loading && !error && alerts.length === 0 ? (
          <div className="empty-state">当前没有新的推送结果，等待下一轮扫描。</div>
        ) : null}

        {alerts.length > 0 ? (
          <VirtualAlertList
            alerts={alerts}
            copiedKey={copiedKey}
            onCopy={handleCopy}
            liveUpdatedAt={data?.liveUpdatedAt}
            streamConnected={streamConnected}
          />
        ) : null}
      </section>
    </main>
  );
}
