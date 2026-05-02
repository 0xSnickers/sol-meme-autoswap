'use client';

import { useEffect, useState } from 'react';
import AppFooter from '../components/AppFooter';
import AppHeader from '../components/AppHeader';
import { PortfolioSection } from '../components/PortfolioCards';
import { formatDuration, formatTime, formatUsd, formatUsdValue } from '../components/formatters';

const POLL_SECONDS = 30;

async function loadSnapshot() {
  const response = await fetch('/api/radar/scan?limit=200', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('读取持仓数据失败');
  }
  return response.json();
}

export default function VaultPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const [countdown, setCountdown] = useState(POLL_SECONDS);
  const [streamConnected, setStreamConnected] = useState(false);
  const [headerMeta, setHeaderMeta] = useState({
    strategyRuntimeLabel: '',
    strategyRuntimeSeconds: 0,
    strategyStartedAt: '',
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const json = await loadSnapshot();
        if (!cancelled) {
          setData(json);
          setHeaderMeta((current) => ({
            strategyRuntimeLabel: json.strategyRuntimeLabel || current.strategyRuntimeLabel,
            strategyRuntimeSeconds: json.strategyRuntimeSeconds ?? current.strategyRuntimeSeconds,
            strategyStartedAt: json.strategyStartedAt || current.strategyStartedAt,
          }));
          setError('');
          setLoading(false);
          setCountdown(POLL_SECONDS);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : '读取持仓数据失败');
          setLoading(false);
        }
      }
    }

    fetchData();

    const pollTimer = window.setInterval(fetchData, POLL_SECONDS * 1000);
    const countdownTimer = window.setInterval(() => {
      setCountdown((current) => (current <= 1 ? POLL_SECONDS : current - 1));
    }, 1000);

    return () => {
      cancelled = true;
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
          <span>浮动盈亏</span>
          <strong className={(data?.paperSummary?.openPnLUsd ?? 0) >= 0 ? 'positive' : 'negative'}>
            {formatUsd(data?.paperSummary?.openPnLUsd ?? 0)}
          </strong>
        </div>
        <div className="stat-pill">
          <span>已实现盈亏</span>
          <strong className={(data?.paperSummary?.closedPnLUsd ?? 0) >= 0 ? 'positive' : 'negative'}>
            {formatUsd(data?.paperSummary?.closedPnLUsd ?? 0)}
          </strong>
        </div>
      </section>

      {error ? <div className="panel error-state panel-gap">{error}</div> : null}

      {!error ? (
        <section className="portfolio-grid">
          <PortfolioSection
            title="当前持仓"
            emptyText="当前没有打开中的持仓。"
            metrics={[
              { label: '买入总金额', value: formatUsdValue(data?.paperSummary?.openCostUsd ?? 0) },
              { label: '当前总市值', value: formatUsdValue(data?.paperSummary?.openValueUsd ?? 0) },
              {
                label: '浮动总盈亏',
                value: formatUsd(data?.paperSummary?.openPnLUsd ?? 0),
                tone: (data?.paperSummary?.openPnLUsd ?? 0) >= 0 ? 'positive' : 'negative',
              },
            ]}
            positions={paperPositions}
            loading={loading}
            copiedKey={copiedKey}
            onCopy={handleCopy}
            streamConnected={streamConnected}
            liveUpdatedAt={data?.liveUpdatedAt}
          />

          <PortfolioSection
            title="已平仓"
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
