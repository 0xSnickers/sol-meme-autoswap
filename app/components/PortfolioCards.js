'use client';

import LoadingBlock from './LoadingBlock';
import { AddressCopy, ExternalLinks } from './token-ui';
import {
  formatPercent,
  formatPrice,
  formatTime,
  formatTokenAmount,
  formatUsd,
  formatUsdValue,
} from './formatters';

export function SummaryMetric({ label, value, tone = 'neutral' }) {
  return (
    <div className="summary-metric">
      <span>{label}</span>
      <strong className={tone === 'positive' ? 'positive' : tone === 'negative' ? 'negative' : ''}>
        {value}
      </strong>
    </div>
  );
}

export function PaperPositionCard({
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
                {streamConnected ? '实时跟踪中' : '实时连接中'}
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
          <p className={(position.pnlPct ?? 0) >= 0 ? 'positive' : 'negative'}>{formatPercent(position.pnlPct)}</p>
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

export function PortfolioSection({
  title,
  emptyText,
  metrics,
  positions,
  type = 'open',
  loading = false,
  copiedKey,
  onCopy,
  streamConnected = false,
  liveUpdatedAt,
}) {
  return (
    <div className="panel portfolio-panel">
      <div className="panel-header compact-header">
        <div>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="summary-metrics">
        {metrics.map((item) => (
          <SummaryMetric key={item.label} label={item.label} value={item.value} tone={item.tone} />
        ))}
      </div>

      {loading ? (
        <div className="list-loading-wrap">
          <LoadingBlock title="Loading" description="正在加载列表数据..." />
        </div>
      ) : null}

      {!loading && positions.length === 0 ? <div className="empty-state compact-empty">{emptyText}</div> : null}

      {!loading && positions.length > 0 ? (
        <div className="position-card-list">
          {positions.map((position) => (
            <PaperPositionCard
              key={`${type}-${position.id}`}
              position={position}
              type={type}
              copiedKey={copiedKey}
              onCopy={onCopy}
              streamConnected={streamConnected}
              liveUpdatedAt={liveUpdatedAt}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
