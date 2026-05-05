'use client';

import LoadingBlock from './LoadingBlock';
import { ExternalLinks, formatAddress } from './token-ui';
import {
  formatPercent,
  formatPrice,
  formatTime,
  formatUsd,
  formatUsdValue,
} from './formatters';

function formatTakeProfitStepsLabel(steps = []) {
  return (steps || []).map((step) => `+${step.targetPercent}%/${step.sellPercent}%`).join(' · ');
}

function formatStopLossLabel(position) {
  const stopLossPct = Number(position?.stopLossPct ?? 0);
  if (!Number.isFinite(stopLossPct) || stopLossPct <= 0) {
    return '--';
  }

  return `-${stopLossPct}%`;
}

function formatExecutedTakeProfitLabel(position) {
  const steps = Array.isArray(position?.takeProfitSteps) ? position.takeProfitSteps : [];
  const tpStage = Math.max(0, Math.min(Number(position?.tpStage ?? 0), steps.length));
  if (steps.length === 0) {
    return '--';
  }

  if (tpStage <= 0) {
    return '未触发';
  }

  const executed = steps
    .slice(0, tpStage)
    .map((step, index) => `TP${index + 1} +${step.targetPercent}%/${step.sellPercent}%`)
    .join(' · ');

  return `已执行 ${tpStage}/${steps.length} 档${executed ? ` · ${executed}` : ''}`;
}

function formatEntrySignalChip(position) {
  const signalText =
    position?.entrySignalCount == null || Number.isNaN(Number(position.entrySignalCount))
      ? '#--'
      : `#${Number(position.entrySignalCount)}`;
  const scoreText =
    position?.tradeScore == null || Number.isNaN(Number(position.tradeScore))
      ? '--'
      : Number(position.tradeScore).toFixed(0);

  return `${signalText} / ${scoreText}`;
}

function formatPositionProgress(position) {
  const totalTokenAmount = Number(position.tokenAmount || 0);
  const remainingTokenAmount = Number(position.remainingTokenAmount ?? position.tokenAmount ?? 0);
  if (totalTokenAmount <= 0) {
    return null;
  }

  const remainingPercent = (remainingTokenAmount / totalTokenAmount) * 100;
  const soldPercent = Math.max(0, 100 - remainingPercent);

  return {
    soldPercent,
    remainingPercent: Math.max(0, remainingPercent),
    soldTokenAmount: Math.max(0, totalTokenAmount - remainingTokenAmount),
  };
}

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
  floatingPnlReady = true,
}) {
  const isClosed = type === 'closed';
  const copyId = `${type}-${position.id}`;
  const valueLabel = isClosed ? '卖出金额' : '当前市值';
  const valueAmount = position.currentValueUsd;
  const valuePrice = position.closePrice || position.currentPrice;
  const remainingCostUsd = Number(position.remainingPositionSizeUsd ?? position.positionSizeUsd ?? 0);
  const progress = !isClosed ? formatPositionProgress(position) : null;
  const remainingPercent = Number(progress?.remainingPercent ?? 0);
  const reducedPercent = Number(progress?.soldPercent ?? 0);
  const showFloatingPnl = isClosed || floatingPnlReady;
  const pnlValue = showFloatingPnl ? formatUsd(position.pnlUsd) : '--';
  const pnlPercent = showFloatingPnl ? formatPercent(position.pnlPct) : '--';
  const pnlToneClass =
    showFloatingPnl && (position.pnlUsd ?? 0) < 0 ? 'negative' : showFloatingPnl ? 'positive' : '';

  return (
    <article className="position-card">
      <div className="position-card-top">
        <div className="token-main">
          <div className="position-token-topline">
            <strong>{position.name}</strong>
            {!isClosed ? (
              <span className={`live-badge compact-live token-live-badge ${streamConnected ? 'connected' : 'disconnected'}`}>
                <span className="live-dot" />
                {streamConnected ? '持仓中' : '连接中'}
              </span>
            ) : null}
            <span className="position-score-chip">入场信号 {formatEntrySignalChip(position)}</span>
          </div>
          <div className="position-token-subline">
            <p>{position.symbol}</p>
            <div className="position-ca-inline">
              <span className="ca-text">{formatAddress(position.address)}</span>
              <button type="button" className="copy-btn compact-copy-btn" onClick={() => onCopy(position.address, copyId)}>
                {copiedKey === copyId ? '已复制' : '复制'}
              </button>
            </div>
          </div>
          <div className="position-token-links-row">
            <ExternalLinks address={position.address} twitter={position.twitter} />
          </div>
        </div>
        <div className="position-pnl">
          <span className="position-pnl-label">{isClosed ? '整笔盈亏' : '当前总盈亏'}</span>
          <strong className={pnlToneClass}>{pnlValue}</strong>
          <p className={showFloatingPnl ? ((position.pnlPct ?? 0) >= 0 ? 'positive' : 'negative') : ''}>{pnlPercent}</p>
        </div>
      </div>

      {!isClosed && progress ? (
        <div className="position-progress-strip compact-progress-strip">
          <div className="position-progress-head">
            <strong>持仓进度</strong>
            <span>当前持仓 {remainingPercent.toFixed(1)}%</span>
          </div>
          <div className="position-progress-track" aria-hidden="true">
            <span
              className="position-progress-bar"
              style={{ width: `${Math.min(100, Math.max(0, remainingPercent))}%` }}
            />
          </div>
          <div className="position-progress-meta">
            <span>已减仓 {reducedPercent.toFixed(1)}%</span>
            <span>剩余市值 {formatUsdValue(valueAmount)}</span>
            <span>剩余成本 {formatUsdValue(remainingCostUsd)}</span>
            <span>已回收 {formatUsdValue(position.realizedProceedsUsd ?? 0)}</span>
          </div>
        </div>
      ) : null}

      <div className="position-metrics">
        <div className="position-metric">
          <span>买入金额</span>
          <strong>{formatUsdValue(position.positionSizeUsd)}</strong>
        </div>
        {isClosed ? (
          <div className="position-metric">
            <span>{valueLabel}</span>
            <strong>{formatUsdValue(valueAmount)}</strong>
          </div>
        ) : null}
        <div className="position-metric">
          <span>买入价</span>
          <strong>{formatPrice(position.entryPrice)}</strong>
        </div>
        <div className="position-metric">
          <span>{isClosed ? '卖出价' : '现价'}</span>
          <strong>{formatPrice(valuePrice)}</strong>
        </div>
      </div>

      <div className="position-rule-grid">
        <div className="position-rule-item">
          <span className="position-mini-label">开单止盈</span>
          <strong className="position-rule-value">{formatTakeProfitStepsLabel(position.takeProfitSteps) || '--'}</strong>
        </div>
        <div className="position-rule-item">
          <span className="position-mini-label">开单止损</span>
          <strong className="position-rule-value">{formatStopLossLabel(position)}</strong>
        </div>
        {isClosed ? (
          <div className="position-rule-item position-rule-item-wide">
            <span className="position-mini-label">分批止盈</span>
            <strong className="position-rule-value">
              {formatExecutedTakeProfitLabel(position)}
              {' · '}
              累计卖出 {formatUsdValue(position.realizedProceedsUsd ?? 0)}
            </strong>
          </div>
        ) : null}
      </div>

      <div className="position-card-footer">
        <div className="position-meta-inline">
          <div className="position-meta-item time-item">
            <span className="position-mini-label">开仓</span>
            <strong className="position-mini-value">{formatTime(position.openedAt)}</strong>
          </div>
          {isClosed ? (
            <div className="position-meta-item">
              <span className="position-mini-label">平仓</span>
              <strong className="position-mini-value">{formatTime(position.closedAt)}</strong>
            </div>
          ) : (
            <div className="position-meta-item">
              <span className="position-mini-label">聪明钱</span>
              <strong className="position-mini-value">{position.smartMoney ?? '--'}</strong>
            </div>
          )}
          {isClosed ? (
            <div className="position-meta-item">
              <span className="position-mini-label">平仓原因</span>
              <strong className="position-mini-value">{position.closeReason || '--'}</strong>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function PortfolioSection({
  title,
  count = 0,
  emptyText,
  metrics,
  positions,
  type = 'open',
  loading = false,
  copiedKey,
  onCopy,
  streamConnected = false,
  floatingPnlReady = true,
}) {
  return (
    <div className="panel portfolio-panel">
      <div className="panel-header compact-header">
        <div className="panel-title-row">
          <h2>{title}</h2>
          <span className="panel-count-badge">{count}</span>
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
              floatingPnlReady={floatingPnlReady}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
