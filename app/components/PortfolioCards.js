'use client';

import LoadingBlock from './LoadingBlock';
import { ChainBadge, LinkIcon, TokenAvatar } from './token-ui';
import { getGmgnTokenUrl } from '../../src/modules/signals/lib/chain-config.js';
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

function CompactCellLine({ label, value, tone = '' }) {
  return (
    <span className="cell-line compact-cell-line">
      <span className="cell-label">{label}</span>
      <span className={`cell-value ${tone}`.trim()}>{value}</span>
    </span>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="portfolio-info-icon">
      <path
        fill="currentColor"
        d="M10 1.75a8.25 8.25 0 1 0 0 16.5 8.25 8.25 0 0 0 0-16.5Zm0 3.5a1.12 1.12 0 1 1 0 2.25 1.12 1.12 0 0 1 0-2.25Zm1.1 9.1H8.9v-1.2h.65V9.55H8.9v-1.2h1.9v4.8h.3v1.2Z"
      />
    </svg>
  );
}

function EmptyFolderIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="portfolio-empty-icon">
      <path
        fill="currentColor"
        d="M4.75 5.5h4.34l1.62 1.85h8.54A2.75 2.75 0 0 1 22 10.1v7.15A2.75 2.75 0 0 1 19.25 20H4.75A2.75 2.75 0 0 1 2 17.25V8.25A2.75 2.75 0 0 1 4.75 5.5Zm0 1.5c-.69 0-1.25.56-1.25 1.25v9c0 .69.56 1.25 1.25 1.25h14.5c.69 0 1.25-.56 1.25-1.25V10.1c0-.69-.56-1.25-1.25-1.25h-9.21L8.42 7H4.75Z"
      />
    </svg>
  );
}

function PaperPositionTable({
  positions,
  type = 'open',
  copiedKey,
  onCopy,
  onClose,
  closingPositionId = null,
  closeDisabled = false,
  streamConnected = false,
  floatingPnlReady = true,
}) {
  const isClosed = type === 'closed';

  return (
    <div className={`table-shell fixed-table-shell position-table-shell ${!isClosed ? 'position-table-shell-open' : ''}`.trim()}>
      <table className={`token-table position-table ${!isClosed ? 'position-table-open' : ''}`.trim()}>
        <thead>
          <tr>
            <th>Token</th>
            <th>价格</th>
            <th>{isClosed ? '成本/回收' : '成本/市值'}</th>
            <th>盈亏</th>
            <th>风控</th>
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
            const isClosing = !isClosed && Number(closingPositionId) === Number(position.id);

            return (
              <tr key={copyId}>
                <td>
                  <div className={`position-token-cell ${!isClosed ? 'position-token-cell-open' : ''}`.trim()}>
                    <div className="position-token-title">
                      <TokenAvatar name={position.name} symbol={position.symbol} imageUrl={position.imageUrl} size="md" />
                      <div className="position-token-text">
                        <div className="position-token-row primary">
                          <div className="position-token-identity">
                            <strong className="position-token-symbol">{position.symbol || '--'}</strong>
                            <span className="position-token-name">{position.name || '--'}</span>
                            <ChainBadge chain={position.chain} />
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
                            {!isClosed ? (
                              <button
                                type="button"
                                className="sort-chip"
                                onClick={() => onClose?.(position)}
                                disabled={closeDisabled || isClosing}
                              >
                                {isClosing ? '平仓中...' : '平仓'}
                              </button>
                            ) : null}
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
                                href={getGmgnTokenUrl(position.chain, position.address)}
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
                          {!isClosed ? <span className="compact-score-chip">聪明钱 {position.smartMoney ?? '--'}</span> : null}
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
                  <div className="cell-stack compact-cell-stack position-price-stack">
                    <CompactCellLine label="买" value={formatPrice(position.entryPrice)} />
                    <CompactCellLine label={isClosed ? '卖' : '现'} value={formatPrice(isClosed ? position.closePrice : position.currentPrice)} />
                  </div>
                </td>
                <td>
                  <div className="cell-stack compact-cell-stack position-size-stack">
                    <CompactCellLine
                      label="成本"
                      value={formatUsdValue(
                        isClosed ? position.positionSizeUsd : position.remainingPositionSizeUsd ?? position.positionSizeUsd
                      )}
                    />
                    <CompactCellLine
                      label={isClosed ? '回收' : '市值'}
                      value={formatUsdValue(isClosed ? position.realizedProceedsUsd ?? 0 : position.currentValueUsd)}
                    />
                    <span className="cell-sub compact-cell-sub">回收 {formatUsdValue(position.realizedProceedsUsd ?? 0)}</span>
                  </div>
                </td>
                <td>
                  <div className="cell-stack compact-cell-stack position-pnl-stack">
                    <strong className={`cell-big ${pnlToneClass} ${pnlStaleClass}`.trim()}>
                      {hasPnlUsd ? formatUsd(Number(pnlUsd)) : '--'}
                    </strong>
                    <span
                      className={`cell-sub compact-cell-sub ${pnlStaleClass} ${
                        hasPnlPct ? (Number(pnlPct) >= 0 ? 'positive' : 'negative') : ''
                      }`.trim()}
                    >
                      {hasPnlPct ? formatPercent(Number(pnlPct)) : '--'}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="cell-stack compact-cell-stack position-risk-stack">
                    <CompactCellLine label="阶段" value={formatTpStageCompact(position)} />
                    <CompactCellLine label="TP" value={formatTpTargetsCompact(position.takeProfitSteps)} />
                    <CompactCellLine label="SL" value={formatStopLossLabel(position)} />
                  </div>
                </td>
                <td>
                  <div className="cell-stack compact-cell-stack position-time-stack">
                    <span className="cell-sub compact-cell-sub">{durationSeconds == null ? '--' : formatDuration(durationSeconds)}</span>
                    <CompactCellLine label="开" value={position.openedAt ? formatTime(position.openedAt) : '--'} />
                    {isClosed ? <CompactCellLine label="平" value={position.closedAt ? formatTime(position.closedAt) : '--'} /> : null}
                  </div>
                </td>
                {isClosed ? (
                  <td>
                    <span className="cell-sub compact-cell-sub">{position.closeReason || '--'}</span>
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

export function SummaryMetric({ label, value, tone = 'neutral', compact = false, icon = null }) {
  return (
    <div className={`summary-metric ${compact ? 'summary-metric-compact' : ''}`.trim()}>
      {icon ? <div className={`summary-metric-icon ${tone === 'positive' ? 'positive' : tone === 'negative' ? 'negative' : ''}`.trim()}>{icon}</div> : null}
      <div className="summary-metric-content">
        <span>{label}</span>
        <strong className={tone === 'positive' ? 'positive' : tone === 'negative' ? 'negative' : ''}>{value}</strong>
      </div>
    </div>
  );
}

export function PortfolioSection({
  title,
  count = 0,
  emptyText,
  emptyHint = '',
  metrics,
  positions,
  type = 'open',
  loading = false,
  copiedKey,
  onCopy,
  onClose,
  closeError = '',
  closingPositionId = null,
  closingAll = false,
  streamConnected = false,
  floatingPnlReady = true,
  headerAside = null,
}) {
  const isOpen = type === 'open';
  const closeDisabled = Boolean(closingAll || closingPositionId != null);

  return (
    <section className={`panel portfolio-panel ${isOpen ? 'is-open' : 'is-closed'}`} aria-labelledby={`portfolio-${type}-title`}>
      <div className="panel-header compact-header portfolio-header-with-aside">
        <div className="portfolio-header-main">
          <div className="panel-title-row">
            <span className={`panel-count-badge ${type === 'closed' ? 'panel-count-closed' : 'panel-count-open'}`}>{count}</span>
            <div className="portfolio-title-stack">
              <h2 id={`portfolio-${type}-title`}>{title}</h2>
              <div className="portfolio-subtitle-row">
                <span className="portfolio-subtitle-text">
                  {isOpen ? '实时持仓与风险管理' : '历史交易与已实现盈亏'}
                </span>
                {isOpen ? (
                  <span className="portfolio-subtitle-icon" aria-hidden="true">
                    <InfoIcon />
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        {headerAside ? <div className="portfolio-header-aside">{headerAside}</div> : null}
      </div>

      <div className={`summary-metrics ${isOpen ? 'summary-metrics-open' : ''}`.trim()}>
        {metrics.map((item) => (
          <SummaryMetric
            key={item.label}
            label={item.label}
            value={item.value}
            tone={item.tone}
            compact={isOpen}
            icon={item.icon}
          />
        ))}
      </div>

      {isOpen && closeError ? <div className="error-state settings-error" role="alert">{closeError}</div> : null}

      {loading ? (
        <div className="list-loading-wrap">
          <LoadingBlock title="正在加载" description="正在加载列表数据..." compact={positions.length > 0} />
        </div>
      ) : null}

      {!loading && positions.length === 0 ? (
        <div className="empty-state compact-empty portfolio-empty-state">
          <EmptyFolderIcon />
          <strong>{emptyText}</strong>
          {emptyHint ? <span>{emptyHint}</span> : null}
        </div>
      ) : null}

      {!loading && positions.length > 0 ? (
        <PaperPositionTable
          positions={positions}
          type={type}
          copiedKey={copiedKey}
          onCopy={onCopy}
          onClose={onClose}
          closingPositionId={closingPositionId}
          closeDisabled={closeDisabled}
          streamConnected={streamConnected}
          floatingPnlReady={floatingPnlReady}
        />
      ) : null}
    </section>
  );
}
