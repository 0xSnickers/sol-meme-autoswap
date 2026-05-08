'use client';

import LoadingBlock from './LoadingBlock';
import { LinkIcon, TokenAvatar } from './token-ui';
import {
  formatPercent,
  formatPrice,
  formatTime,
  formatDuration,
  formatUsd,
  formatUsdValue,
} from './formatters';

function formatStopLossLabel(position) {
  const stopLossPct = Number(position?.stopLossPct ?? 0);
  if (!Number.isFinite(stopLossPct) || stopLossPct <= 0) {
    return '--';
  }

  return `-${stopLossPct}%`;
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


function formatTpTargetsCompact(steps = []) {
  const targets = (steps || [])
    .map((step) => Number(step?.targetPercent))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (targets.length === 0) {
    return '--';
  }

  return targets.map((value) => `+${value}%`).join(' · ');
}

function formatTpStageCompact(position) {
  const steps = Array.isArray(position?.takeProfitSteps) ? position.takeProfitSteps : [];
  const total = steps.length;
  if (!total) {
    return '--';
  }

  const tpStage = Math.max(0, Math.min(Number(position?.tpStage ?? 0), total));
  return `TP ${tpStage}/${total}`;
}

function getDurationSeconds(position, isClosed) {
  const opened = position?.openedAt ? new Date(position.openedAt).getTime() : null;
  if (!opened) {
    return null;
  }

  const ended = isClosed
    ? position?.closedAt
      ? new Date(position.closedAt).getTime()
      : null
    : Date.now();

  if (!ended) {
    return null;
  }

  return Math.max(0, Math.floor((ended - opened) / 1000));
}

function PaperPositionTable({
  positions,
  type = 'open',
  copiedKey,
  onCopy,
  streamConnected = false,
  floatingPnlReady = true,
}) {
  const isClosed = type === 'closed';

  return (
    <div className="table-shell fixed-table-shell position-table-shell">
      <table className="token-table position-table">
        <thead>
          <tr>
            <th>Token</th>
            <th>价格</th>
            <th>{isClosed ? '成本/回收' : '成本/市值'}</th>
            <th>盈亏</th>
            <th>TP/风控</th>
            <th>时间</th>
            {isClosed ? <th>原因</th> : null}
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => {
            const copyId = `${type}-${position.id}`;
            const durationSeconds = getDurationSeconds(position, isClosed);
            const pnlUsd = position?.pnlUsd;
            const pnlPct = position?.pnlPct;
            const hasPnlUsd = pnlUsd != null && Number.isFinite(Number(pnlUsd));
            const hasPnlPct = pnlPct != null && Number.isFinite(Number(pnlPct));
            const pnlToneClass = hasPnlUsd && Number(pnlUsd) < 0 ? 'negative' : hasPnlUsd ? 'positive' : '';
            const pnlStaleClass = !floatingPnlReady && !isClosed ? 'pnl-stale' : '';

            return (
              <tr key={copyId}>
                <td>
                  <div className="position-token-cell">
                    <div className="position-token-title">
                      <TokenAvatar name={position.name} symbol={position.symbol} imageUrl={position.imageUrl} size="md" />
                      <div className="position-token-text">
                        <div className="position-token-row primary">
                          <div className="position-token-identity">
                            <strong className="position-token-symbol">{position.symbol || '--'}</strong>
                            <span className="position-token-name">{position.name || '--'}</span>
                            <button
                              type="button"
                              className="icon-link copy-icon-link inline-copy-icon"
                              onClick={() => onCopy(position.address, copyId)}
                              title="复制 CA"
                              aria-label="复制 CA"
                            >
                              {copiedKey === copyId ? '✓' : '⧉'}
                            </button>
                          </div>
                          <div className="position-token-actions">
                            {position.twitter ? (
                              <a
                                href={position.twitter}
                                target="_blank"
                                rel="noreferrer"
                                className="icon-link vault-icon-link"
                                title="X"
                                aria-label="X"
                              >
                                <LinkIcon kind="x" />
                              </a>
                            ) : null}
                            {position.address ? (
                              <a
                                href={`https://gmgn.ai/sol/token/${position.address}`}
                                target="_blank"
                                rel="noreferrer"
                                className="icon-link vault-icon-link"
                                title="GMGN"
                                aria-label="GMGN"
                              >
                                <LinkIcon kind="gmgn" />
                              </a>
                            ) : null}
                          </div>
                        </div>
                        <div className="position-token-row secondary">
                          <span className="position-score-chip compact-score-chip">信号 {formatEntrySignalChip(position)}</span>
                          {!isClosed ? (
                            <span className="compact-score-chip">聪明钱 {position.smartMoney ?? '--'}</span>
                          ) : null}
                        </div>
                        {!isClosed ? (
                          <div className="position-token-row tertiary">
                            <span
                              className={`live-badge compact-live token-live-badge ${streamConnected ? 'connected' : 'disconnected'}`}
                            >
                              <span className="live-dot" />
                              {streamConnected ? '持仓中' : '连接中'}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="cell-stack">
                    <span className="cell-line">
                      <span className="cell-label">买入</span>
                      <span className="cell-value">{formatPrice(position.entryPrice)}</span>
                    </span>
                    <span className="cell-line">
                      <span className="cell-label">{isClosed ? '卖出' : '现价'}</span>
                      <span className="cell-value">{formatPrice(isClosed ? position.closePrice : position.currentPrice)}</span>
                    </span>
                  </div>
                </td>
                <td>
                  <div className="cell-stack">
                    <span className="cell-line">
                      <span className="cell-label">成本</span>
                      <span className="cell-value">
                        {formatUsdValue(
                          isClosed
                            ? position.positionSizeUsd
                            : position.remainingPositionSizeUsd ?? position.positionSizeUsd
                        )}
                      </span>
                    </span>
                    <span className="cell-line">
                      <span className="cell-label">{isClosed ? '回收' : '市值'}</span>
                      <span className="cell-value">
                        {formatUsdValue(isClosed ? position.realizedProceedsUsd ?? 0 : position.currentValueUsd)}
                      </span>
                    </span>
                    {!isClosed ? (
                      <span className="cell-sub">
                        已回收 {formatUsdValue(position.realizedProceedsUsd ?? 0)}
                      </span>
                    ) : (
                      <span className="cell-sub">已回收 {formatUsdValue(position.realizedProceedsUsd ?? 0)}</span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="cell-stack">
                    <strong className={`cell-big ${pnlToneClass} ${pnlStaleClass}`}>
                      {hasPnlUsd ? formatUsd(Number(pnlUsd)) : '--'}
                    </strong>
                    <span
                      className={`cell-sub ${pnlStaleClass} ${
                        hasPnlPct ? (Number(pnlPct) >= 0 ? 'positive' : 'negative') : ''
                      }`}
                    >
                      {hasPnlPct ? formatPercent(Number(pnlPct)) : '--'}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="cell-stack">
                    <span className="cell-sub">{formatTpStageCompact(position)}</span>
                    <span className="cell-sub">TP {formatTpTargetsCompact(position.takeProfitSteps)}</span>
                    <span className="cell-sub">SL {formatStopLossLabel(position)}</span>
                  </div>
                </td>
                <td>
                  <div className="cell-stack">
                    <span className="cell-sub">{durationSeconds == null ? '--' : formatDuration(durationSeconds)}</span>
                    <span className="cell-sub">开 {position.openedAt ? formatTime(position.openedAt) : '--'}</span>
                    {isClosed ? <span className="cell-sub">平 {position.closedAt ? formatTime(position.closedAt) : '--'}</span> : null}
                  </div>
                </td>
                {isClosed ? (
                  <td>
                    <span className="cell-sub">{position.closeReason || '--'}</span>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
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
          <span className={`panel-count-badge ${type === 'closed' ? 'panel-count-closed' : 'panel-count-open'}`}>
            {count}
          </span>
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
        <PaperPositionTable
          positions={positions}
          type={type}
          copiedKey={copiedKey}
          onCopy={onCopy}
          streamConnected={streamConnected}
          floatingPnlReady={floatingPnlReady}
        />
      ) : null}
    </div>
  );
}
