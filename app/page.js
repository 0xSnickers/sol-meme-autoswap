'use client';

import { useEffect, useMemo, useState } from 'react';
import AppFooter from './components/AppFooter';
import AppHeader from './components/AppHeader';
import LoadingBlock from './components/LoadingBlock';
import TokenSignalTimeline, { ScoreWithTooltip } from './components/TokenSignalTimeline';
import VirtualListTable from './components/VirtualListTable';
import { AddressCopy, ExternalLinks, TokenAvatar } from './components/token-ui';

const POLL_SECONDS = 30;
const ALERT_ROW_HEIGHT = 214;
const ALERT_LIST_HEIGHT = 600;

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

function formatLiquidity(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '--';
  }

  const number = Number(value);
  if (number >= 1000000) {
    return `$${(number / 1000000).toFixed(2)}M`;
  }
  if (number >= 1000) {
    return `$${(number / 1000).toFixed(1)}k`;
  }
  return `$${number.toFixed(0)}`;
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

function formatTradeActionLabel(alert) {
  const reason = String(alert?.tradeDecisionReason || '');
  if (reason.includes('不再分批加仓') || reason.includes('头仓已一次性买满')) {
    return '持仓观察';
  }
  if (reason.includes('第2次信号评分走强')) {
    return '补开头仓';
  }
  if (reason.includes('头仓条件')) {
    return '头仓';
  }
  if (reason.includes('头仓仅允许第 1-2 次')) {
    return '错过头仓窗口';
  }
  return alert?.tradeDecisionStatus === 'approved' ? '可执行' : '观察中';
}

function formatTradeReasonHint(alert) {
  const reason = String(alert?.tradeDecisionReason || '');
  if (!reason) {
    return '';
  }
  if (reason.includes('高热模式')) {
    return '高热限制';
  }
  if (reason.includes('买卖比')) {
    return '买卖比不足';
  }
  if (reason.includes('流动性')) {
    return '流动性不足';
  }
  if (reason.includes('成交量')) {
    return '成交量不足';
  }
  if (reason.includes('评分')) {
    return '评分不足';
  }
  if (reason.includes('头仓仅允许')) {
    return '错过头仓';
  }
  if (reason.includes('不再分批加仓') || reason.includes('头仓已一次性买满')) {
    return '已满目标仓';
  }
  return '';
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

function formatTakeProfitSteps(steps = []) {
  return (steps || [])
    .map((step) => `+${step.targetPercent}%/${step.sellPercent}%`)
    .join(' · ');
}

function getTelegramTradeScore(alert) {
  const signalCount = Number(alert?.occurrenceCount || alert?.signalCount || 1);
  const smartMoney = Number(alert?.smartMoney || 0);
  const pctGain = Number(alert?.pctGain || 0);
  const liquidity = Number(alert?.liq || 0);
  const volume = Number(alert?.volume || 0);
  const buySellRatio = Number(alert?.buySellRatio || 0);
  const ageHours = Number(alert?.ageHours || 0);
  const oneHourChange = Number(alert?.change1h || 0);

  let score = 0;

  if (smartMoney >= 15) {
    score += 30;
  } else if (smartMoney >= 8) {
    score += 22;
  } else if (smartMoney >= 5) {
    score += 14;
  } else if (smartMoney >= 3) {
    score += 8;
  } else if (smartMoney >= 2) {
    score += 4;
  }

  if (signalCount <= 1) {
    score += 10;
  } else if (signalCount === 2) {
    score += 6;
  } else if (signalCount === 3) {
    score += 2;
  } else {
    score -= 6;
  }

  if (pctGain >= 15) {
    score += 15;
  } else if (pctGain >= 10) {
    score += 12;
  } else if (pctGain >= 8) {
    score += 8;
  } else if (pctGain >= 5) {
    score += 5;
  }

  if (liquidity >= 100000) {
    score += 16;
  } else if (liquidity >= 50000) {
    score += 12;
  } else if (liquidity >= 20000) {
    score += 10;
  } else if (liquidity >= 10000) {
    score += 6;
  } else if (liquidity >= 5000) {
    score += 2;
  }

  if (volume >= 500000) {
    score += 16;
  } else if (volume >= 200000) {
    score += 12;
  } else if (volume >= 100000) {
    score += 10;
  } else if (volume >= 50000) {
    score += 7;
  } else if (volume >= 30000) {
    score += 4;
  }

  if (buySellRatio >= 2) {
    score += 12;
  } else if (buySellRatio >= 1.8) {
    score += 9;
  } else if (buySellRatio >= 1.6) {
    score += 6;
  } else if (buySellRatio >= 1.4) {
    score += 3;
  } else if (buySellRatio < 1.2) {
    score -= 6;
  } else if (buySellRatio < 1.4) {
    score -= 2;
  }

  if (ageHours <= 6) {
    score += 5;
  } else if (ageHours <= 12) {
    score += 4;
  } else if (ageHours <= 24) {
    score += 3;
  } else if (ageHours <= 48) {
    score += 1;
  }

  if (oneHourChange >= 80) {
    score -= 18;
  } else if (oneHourChange >= 50) {
    score -= 10;
  } else if (oneHourChange >= 30) {
    score -= 4;
  }

  const finalScore = Math.max(0, Math.round(score));
  let label = '观察';
  if (finalScore >= 80) {
    label = '强势';
  } else if (finalScore >= 65) {
    label = '偏强';
  } else if (finalScore >= 50) {
    label = '中性';
  }

  return { score: finalScore, label };
}

function getPriceActionScore(alert) {
  const rounds = Number(alert?.occurrenceCount || alert?.signalCount || 1);
  const pctGain = Number(alert?.pctGain || 0);
  const smartMoney = Number(alert?.smartMoney || 0);
  const volume = Number(alert?.volume || 0);
  const liquidity = Number(alert?.liq || 0);
  const oneHourChange = Number(alert?.change1h || 0);
  const buySellRatio = Number(alert?.buySellRatio || 0);
  const volUp = Boolean(alert?.volUp || alert?.volumeUp || alert?.volumeRising);

  let score = 0;

  if (rounds >= 3) {
    score += 20;
  } else if (rounds >= 2) {
    score += 10;
  }

  if (pctGain >= 30) {
    score += 25;
  } else if (pctGain >= 15) {
    score += 18;
  } else if (pctGain >= 8) {
    score += 12;
  } else if (pctGain >= 5) {
    score += 8;
  }

  if (volUp) {
    score += 10;
  }

  if (smartMoney >= 5) {
    score += 15;
  } else if (smartMoney >= 3) {
    score += 10;
  } else if (smartMoney >= 2) {
    score += 6;
  }

  if (buySellRatio >= 1.5) {
    score += 12;
  } else if (buySellRatio >= 1.2) {
    score += 8;
  } else if (buySellRatio >= 1.1) {
    score += 5;
  }

  if (volume >= 100000) {
    score += 10;
  } else if (volume >= 30000) {
    score += 6;
  }

  if (liquidity >= 20000) {
    score += 8;
  } else if (liquidity >= 10000) {
    score += 5;
  }

  if (oneHourChange >= 80) {
    score -= 15;
  } else if (oneHourChange >= 50) {
    score -= 8;
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  let label = '观察';
  if (finalScore >= 80) label = '强势';
  else if (finalScore >= 65) label = '偏强';
  else if (finalScore >= 50) label = '中性';

  return { score: finalScore, label };
}

function getTradeEvalIcons(alert) {
  const items = [];
  const reasonHint = formatTradeReasonHint(alert);
  if (reasonHint) {
    items.push({ icon: '!', label: '原因', text: reasonHint });
  }
  items.push({
    icon: 'TP',
    label: '止盈',
    text: `TP ${formatTakeProfitSteps(alert.paperTakeProfitSteps || [{ targetPercent: 40, sellPercent: 50 }])}`,
  });
  items.push({
    icon: 'SL',
    label: '止损',
    text: `SL -${alert.paperStopLossPct ?? 50}%`,
  });
  return items;
}

function getTradeScoreValue(alert) {
  const value = Number(alert?.tradeScore);
  return Number.isFinite(value) ? value : '--';
}

function AlertRow({ alert, copiedKey, onCopy, streamConnected }) {
  const copyId = `alert-${alert.address}-${alert.latestPushedAt || alert.pushedAt}`;

  return (
    <>
      <div className="virtual-cell token-cell">
        <div className="token-main token-main-compact">
          <div className="token-title-row position-token-topline token-title-row-compact">
            <TokenAvatar name={alert.name} symbol={alert.symbol} imageUrl={alert.imageUrl} />
            <div className="token-label-stack">
              <div className="token-title-inline">
                <strong className="token-symbol-primary">{alert.symbol}</strong>
                <span className={`live-badge compact-live token-live-badge ${streamConnected ? 'connected' : 'disconnected'}`}>
                  <span className="live-dot" />
                  {streamConnected ? '实时' : '连接中'}
                </span>
                <ExternalLinks
                  address={alert.address}
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
          <strong className={alert.pctGain >= 0 ? 'positive' : 'negative'}>{formatPercent(alert.pctGain)}</strong>
          <span className="metric-inline">1h {formatPercent(alert.change1h || 0)}</span>
        </div>
      </div>
      <div className="virtual-cell trade-cell compact-trade-cell">
        <div className="trade-score-compact">
          <span className="score-inline-pill trade-score-line">交易评分：{getTelegramTradeScore(alert).score}</span>
          <span className="score-inline-pill muted trade-score-line">价格评分：{getPriceActionScore(alert).score}</span>
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

function VirtualAlertList({ alerts, copiedKey, onCopy, streamConnected }) {
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
      renderRow={(alert) => (
        <AlertRow
          alert={alert}
          copiedKey={copiedKey}
          onCopy={onCopy}
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
        const response = await fetch('/api/signals/snapshot?limit=200', {
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
    const source = new EventSource('/api/signals/stream?limit=200');

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
      <AppHeader
        title="最新信号"
        navKey="pulse"
        statusCards={miniStatusCards}
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
            streamConnected={streamConnected}
          />
        ) : null}
      </section>

      <AppFooter />
    </main>
  );
}
