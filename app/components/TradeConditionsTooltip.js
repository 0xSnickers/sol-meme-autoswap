'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  formatLiquidity,
  formatPercent,
} from '../../src/modules/signals/lib/signal-formatters.js';

const DEFAULT_TRADE_CONFIG = {
  tradeScoreThreshold: 64,
  tradeMinSmartMoney: 3,
  tradeMaxSignalCount: 3,
  tradeHeadEntrySignalCount: 1,
  tradeSecondHeadEntrySignalCount: 2,
  tradeMinLiquidity: 15_000,
  tradeMinVolume: 30_000,
  tradeMinBuySellRatio: 1.4,
  tradeMaxTokenAgeHours: 48,
  tradeHotModeChange1h: 50,
  tradeHotModeMinSmartMoney: 5,
  tradeHotModeMinLiquidity: 30_000,
  tradeHotModeMinBuySellRatio: 1.6,
  tradeHotModeMinScore: 68,
  tradeSecondHeadMinScore: 68,
  tradeSecondHeadMinScoreDelta: 5,
};

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function resolveTradeConfig(snapshotConfig = {}) {
  return {
    ...DEFAULT_TRADE_CONFIG,
    tradeScoreThreshold:
      toFiniteNumber(snapshotConfig.tradeScoreThreshold) ?? DEFAULT_TRADE_CONFIG.tradeScoreThreshold,
    tradeMinSmartMoney:
      toFiniteNumber(snapshotConfig.tradeMinSmartMoney) ?? DEFAULT_TRADE_CONFIG.tradeMinSmartMoney,
    tradeMaxSignalCount:
      toFiniteNumber(snapshotConfig.tradeMaxSignalCount) ?? DEFAULT_TRADE_CONFIG.tradeMaxSignalCount,
    tradeHeadEntrySignalCount:
      toFiniteNumber(snapshotConfig.tradeHeadEntrySignalCount) ??
      DEFAULT_TRADE_CONFIG.tradeHeadEntrySignalCount,
    tradeSecondHeadEntrySignalCount:
      toFiniteNumber(snapshotConfig.tradeSecondHeadEntrySignalCount) ??
      DEFAULT_TRADE_CONFIG.tradeSecondHeadEntrySignalCount,
    tradeMinLiquidity:
      toFiniteNumber(snapshotConfig.tradeMinLiquidity) ?? DEFAULT_TRADE_CONFIG.tradeMinLiquidity,
    tradeMinVolume:
      toFiniteNumber(snapshotConfig.tradeMinVolume) ?? DEFAULT_TRADE_CONFIG.tradeMinVolume,
    tradeMinBuySellRatio:
      toFiniteNumber(snapshotConfig.tradeMinBuySellRatio) ??
      DEFAULT_TRADE_CONFIG.tradeMinBuySellRatio,
    tradeMaxTokenAgeHours:
      toFiniteNumber(snapshotConfig.tradeMaxTokenAgeHours) ??
      DEFAULT_TRADE_CONFIG.tradeMaxTokenAgeHours,
    tradeHotModeChange1h:
      toFiniteNumber(snapshotConfig.tradeHotModeChange1h) ??
      DEFAULT_TRADE_CONFIG.tradeHotModeChange1h,
    tradeHotModeMinSmartMoney:
      toFiniteNumber(snapshotConfig.tradeHotModeMinSmartMoney) ??
      DEFAULT_TRADE_CONFIG.tradeHotModeMinSmartMoney,
    tradeHotModeMinLiquidity:
      toFiniteNumber(snapshotConfig.tradeHotModeMinLiquidity) ??
      DEFAULT_TRADE_CONFIG.tradeHotModeMinLiquidity,
    tradeHotModeMinBuySellRatio:
      toFiniteNumber(snapshotConfig.tradeHotModeMinBuySellRatio) ??
      DEFAULT_TRADE_CONFIG.tradeHotModeMinBuySellRatio,
    tradeHotModeMinScore:
      toFiniteNumber(snapshotConfig.tradeHotModeMinScore) ?? DEFAULT_TRADE_CONFIG.tradeHotModeMinScore,
    tradeSecondHeadMinScore:
      toFiniteNumber(snapshotConfig.tradeSecondHeadMinScore) ??
      DEFAULT_TRADE_CONFIG.tradeSecondHeadMinScore,
    tradeSecondHeadMinScoreDelta:
      toFiniteNumber(snapshotConfig.tradeSecondHeadMinScoreDelta) ??
      DEFAULT_TRADE_CONFIG.tradeSecondHeadMinScoreDelta,
  };
}

function splitReasonLines(reason) {
  return String(reason || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDecisionStatus(status) {
  switch (status) {
    case 'approved':
      return '允许开仓';
    case 'skipped':
      return '已跳过';
    case 'rejected':
      return '未交易';
    default:
      return '待判断';
  }
}

function formatPositionStatus(status) {
  switch (status) {
    case 'open':
      return '持仓中';
    case 'closed':
      return '已平仓';
    default:
      return '未开仓';
  }
}

function formatMetricNumber(value, digits = 1) {
  if (!Number.isFinite(Number(value))) {
    return '--';
  }
  return Number(value).toFixed(digits).replace(/\.0+$/, '');
}

function getPreviousSignalScore(signal) {
  const currentSignalCount = toFiniteNumber(signal?.signalCount);
  const history = Array.isArray(signal?.signalHistory) ? signal.signalHistory : [];
  const previousItems = history
    .map((item) => ({
      signalCount: toFiniteNumber(item?.signalCount),
      pushedAt: item?.pushedAt ? new Date(item.pushedAt).getTime() : 0,
      tradeScore: toFiniteNumber(item?.tradeScore),
    }))
    .filter(
      (item) =>
        item.tradeScore != null &&
        item.signalCount != null &&
        currentSignalCount != null &&
        item.signalCount < currentSignalCount
    )
    .sort((left, right) => {
      if (left.signalCount !== right.signalCount) {
        return right.signalCount - left.signalCount;
      }
      return right.pushedAt - left.pushedAt;
    });

  return previousItems[0]?.tradeScore ?? null;
}

function createCondition(passed, label, detail = '') {
  return {
    passed: Boolean(passed),
    label,
    detail,
  };
}

function buildTradeConditionSections(signal, snapshotConfig) {
  const config = resolveTradeConfig(snapshotConfig);
  const tradeScore = toFiniteNumber(signal?.tradeScore);
  const signalCount = toFiniteNumber(signal?.signalCount);
  const smartMoney = toFiniteNumber(signal?.smartMoney);
  const liquidity = toFiniteNumber(signal?.liq);
  const volume = toFiniteNumber(signal?.volume);
  const buySellRatio = toFiniteNumber(signal?.buySellRatio);
  const ageHours = toFiniteNumber(signal?.ageHours);
  const change1h = toFiniteNumber(signal?.change1h);
  const previousScore = getPreviousSignalScore(signal);
  const scoreDelta =
    tradeScore != null && previousScore != null ? Number(tradeScore - previousScore) : null;
  const paperPositionStatus = signal?.paperPositionStatus;
  const hasOpenPosition = paperPositionStatus === 'open';
  const isSecondSignal = signalCount === config.tradeSecondHeadEntrySignalCount;
  const exceedsHeadWindow =
    signalCount != null && signalCount > config.tradeSecondHeadEntrySignalCount;
  const isHotMode = change1h != null && change1h >= config.tradeHotModeChange1h;

  const baseItems = [
    createCondition(
      tradeScore != null && tradeScore >= config.tradeScoreThreshold,
      `交易评分 >= ${config.tradeScoreThreshold}`,
      `${formatMetricNumber(tradeScore, 0)} / ${config.tradeScoreThreshold}`
    ),
    createCondition(
      signalCount != null &&
        signalCount >= config.tradeHeadEntrySignalCount &&
        signalCount <= config.tradeSecondHeadEntrySignalCount,
      `信号次数在 ${config.tradeHeadEntrySignalCount}-${config.tradeSecondHeadEntrySignalCount} 次内`,
      `当前第 ${formatMetricNumber(signalCount, 0)} 次信号`
    ),
    createCondition(
      smartMoney != null && smartMoney >= config.tradeMinSmartMoney,
      `聪明钱 >= ${config.tradeMinSmartMoney}`,
      `${formatMetricNumber(smartMoney, 0)} / ${config.tradeMinSmartMoney}`
    ),
    createCondition(
      liquidity != null && liquidity >= config.tradeMinLiquidity,
      `流动性 >= ${formatLiquidity(config.tradeMinLiquidity)}`,
      `${formatLiquidity(liquidity || 0)} / ${formatLiquidity(config.tradeMinLiquidity)}`
    ),
    createCondition(
      volume != null && volume >= config.tradeMinVolume,
      `1h 成交量 >= ${formatLiquidity(config.tradeMinVolume)}`,
      `${formatLiquidity(volume || 0)} / ${formatLiquidity(config.tradeMinVolume)}`
    ),
    createCondition(
      buySellRatio != null && buySellRatio >= config.tradeMinBuySellRatio,
      `买卖比 >= ${config.tradeMinBuySellRatio}`,
      `${formatMetricNumber(buySellRatio, 2)} / ${config.tradeMinBuySellRatio}`
    ),
    createCondition(
      ageHours != null && ageHours <= config.tradeMaxTokenAgeHours,
      `币龄 <= ${config.tradeMaxTokenAgeHours}h`,
      `${formatMetricNumber(ageHours, 1)}h / ${config.tradeMaxTokenAgeHours}h`
    ),
  ];

  const extraSections = [];

  if (isSecondSignal) {
    extraSections.push({
      title: '第 2 次信号附加条件',
      items: [
        createCondition(previousScore != null, '存在上一次评分记录', previousScore == null ? '缺少历史评分' : `上次 ${formatMetricNumber(previousScore, 0)}`),
        createCondition(
          tradeScore != null && tradeScore >= config.tradeSecondHeadMinScore,
          `当前评分 >= ${config.tradeSecondHeadMinScore}`,
          `${formatMetricNumber(tradeScore, 0)} / ${config.tradeSecondHeadMinScore}`
        ),
        createCondition(
          scoreDelta != null && scoreDelta >= config.tradeSecondHeadMinScoreDelta,
          `较上次评分提升 >= ${config.tradeSecondHeadMinScoreDelta}`,
          scoreDelta == null ? '缺少对比数据' : `${scoreDelta >= 0 ? '+' : ''}${formatMetricNumber(scoreDelta, 1)}`
        ),
      ],
    });
  } else if (exceedsHeadWindow) {
    extraSections.push({
      title: '信号窗口',
      items: [
        createCondition(
          false,
          `头仓仅允许第 ${config.tradeHeadEntrySignalCount}-${config.tradeSecondHeadEntrySignalCount} 次信号`,
          `当前第 ${formatMetricNumber(signalCount, 0)} 次信号`
        ),
      ],
    });
  }

  if (isHotMode) {
    extraSections.push({
      title: `高热模式 (${formatPercent(change1h)})`,
      items: [
        createCondition(
          tradeScore != null && tradeScore >= config.tradeHotModeMinScore,
          `高热评分 >= ${config.tradeHotModeMinScore}`,
          `${formatMetricNumber(tradeScore, 0)} / ${config.tradeHotModeMinScore}`
        ),
        createCondition(
          smartMoney != null && smartMoney >= config.tradeHotModeMinSmartMoney,
          `高热聪明钱 >= ${config.tradeHotModeMinSmartMoney}`,
          `${formatMetricNumber(smartMoney, 0)} / ${config.tradeHotModeMinSmartMoney}`
        ),
        createCondition(
          liquidity != null && liquidity >= config.tradeHotModeMinLiquidity,
          `高热流动性 >= ${formatLiquidity(config.tradeHotModeMinLiquidity)}`,
          `${formatLiquidity(liquidity || 0)} / ${formatLiquidity(config.tradeHotModeMinLiquidity)}`
        ),
        createCondition(
          buySellRatio != null && buySellRatio >= config.tradeHotModeMinBuySellRatio,
          `高热买卖比 >= ${config.tradeHotModeMinBuySellRatio}`,
          `${formatMetricNumber(buySellRatio, 2)} / ${config.tradeHotModeMinBuySellRatio}`
        ),
      ],
    });
  }

  const allItems = [baseItems, ...extraSections.map((section) => section.items)].flat();
  const passedCount = allItems.filter((item) => item.passed).length;
  const totalCount = allItems.length;
  const positionStatusLabel = formatPositionStatus(paperPositionStatus);
  const positionStatusHint = hasOpenPosition ? '当前策略不再对该 Token 加仓' : '';

  return {
    summaryLabel: hasOpenPosition ? '持仓中（不再加仓）' : passedCount === totalCount ? '满足开仓条件' : '未满足开仓条件',
    summaryTone: hasOpenPosition ? 'skipped' : passedCount === totalCount ? 'approved' : 'rejected',
    passedCount,
    totalCount,
    decisionStatusLabel: formatDecisionStatus(signal?.tradeDecisionStatus),
    positionStatusLabel,
    positionStatusHint,
    sections: [
      {
        title: '基础条件',
        items: baseItems,
      },
      ...extraSections,
    ],
  };
}

function FloatingTooltipTrigger({
  children,
  content,
  preferBelow = false,
  tooltipWidth = 360,
}) {
  const wrapRef = useRef(null);
  const tooltipRef = useRef(null);
  const closeTimerRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [tooltipMeta, setTooltipMeta] = useState({ left: 0, top: 0, width: tooltipWidth, placement: 'top' });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(
    () => () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    },
    []
  );

  function openTooltip() {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpen(true);
  }

  function scheduleClose() {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 140);
  }

  useEffect(() => {
    if (!open || !mounted) {
      return undefined;
    }

    const updatePosition = () => {
      if (!wrapRef.current) {
        return;
      }
      const rect = wrapRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 12;
      const width = Math.min(tooltipWidth, Math.max(240, viewportWidth - margin * 2));
      const maxHeight = Math.min(320, Math.floor(viewportHeight * 0.62));
      const tooltipHeight = tooltipRef.current?.offsetHeight || 0;
      const centerX = rect.left + rect.width / 2;
      const left = Math.min(
        viewportWidth - margin - width / 2,
        Math.max(margin + width / 2, centerX)
      );
      const showBelow = preferBelow || rect.top < tooltipHeight + 20;
      const top = showBelow
        ? Math.min(viewportHeight - margin, rect.bottom + 10)
        : Math.max(margin, rect.top - 10);

      setTooltipMeta({
        left,
        top,
        width,
        maxHeight,
        placement: showBelow ? 'bottom' : 'top',
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [mounted, open, preferBelow, tooltipWidth]);

  const tooltip = mounted && open && content
    ? createPortal(
        <div
          ref={tooltipRef}
          className={`trade-reason-tooltip trade-reason-tooltip-floating ${
            tooltipMeta.placement === 'bottom' ? 'prefer-below' : ''
          }`}
          role="tooltip"
          onMouseEnter={openTooltip}
          onMouseLeave={scheduleClose}
          style={{
            left: tooltipMeta.left,
            top: tooltipMeta.top,
            width: tooltipMeta.width,
            maxHeight: tooltipMeta.maxHeight,
          }}
        >
          {content}
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <span
        ref={wrapRef}
        className="trade-reason-tooltip-wrap"
        tabIndex={0}
        onMouseEnter={openTooltip}
        onMouseLeave={scheduleClose}
        onFocus={openTooltip}
        onBlur={scheduleClose}
      >
        {children}
      </span>
      {tooltip}
    </>
  );
}

function ReasonTooltipBody({ signal }) {
  const lines = splitReasonLines(signal?.tradeDecisionReason);

  if (!lines.length) {
    return (
      <div className="trade-tooltip-empty">
        暂无提示信息
      </div>
    );
  }

  return (
    <>
      <div className="trade-tooltip-header">
        <strong>交易提示</strong>
      </div>
      <div className="trade-tooltip-meta">
        <span>共 {lines.length} 条提示</span>
      </div>
      <div className="trade-tooltip-section">
        <span className="trade-reason-tooltip-list">
          {lines.map((line, index) => (
            <span key={`reason-${index}`} className="trade-reason-tooltip-item">
              <span className="trade-reason-tooltip-index">{index + 1}.</span>
              <span className="trade-reason-tooltip-text">{line}</span>
            </span>
          ))}
        </span>
      </div>
    </>
  );
}

function TradeConditionsTooltipBody({ signal, snapshotConfig }) {
  const meta = useMemo(
    () => buildTradeConditionSections(signal, snapshotConfig),
    [signal, snapshotConfig]
  );

  return (
    <>
      <div className="trade-tooltip-header">
        <strong>开仓条件</strong>
        <span className={`trade-tooltip-badge ${meta.summaryTone}`}>
          {meta.summaryLabel}
        </span>
      </div>
      <div className="trade-tooltip-meta">
        <span>Token 条件命中 {meta.passedCount}/{meta.totalCount}</span>
        <span>系统判定: {meta.decisionStatusLabel}</span>
        <span>持仓状态: {meta.positionStatusLabel}{meta.positionStatusHint ? `（${meta.positionStatusHint}）` : ''}</span>
      </div>

      {meta.sections.map((section, sectionIndex) => (
        <div key={section.title} className="trade-tooltip-section">
          <span className="trade-tooltip-section-title">{section.title}</span>
          <span
            className={`trade-condition-list ${
              sectionIndex === 0 ? 'trade-condition-list-grid' : ''
            }`}
          >
            {section.items.map((item, index) => (
              <span
                key={`${section.title}-${index}`}
                className={`trade-condition-item ${item.passed ? 'passed' : 'failed'}`}
              >
                <span className="trade-condition-icon" aria-hidden="true">
                  {item.passed ? 'OK' : 'NO'}
                </span>
                <span className="trade-condition-copy">
                  <span className="trade-condition-label">
                    {item.passed ? '✅' : '❌'} {item.label}
                  </span>
                  {item.detail ? (
                    <span className="trade-condition-detail">{item.detail}</span>
                  ) : null}
                </span>
              </span>
            ))}
          </span>
        </div>
      ))}
    </>
  );
}

export function TradeConditionsTooltipTrigger({
  signal,
  snapshotConfig,
  preferBelow = false,
  children,
  tooltipWidth = 360,
}) {
  return (
    <FloatingTooltipTrigger
      preferBelow={preferBelow}
      tooltipWidth={tooltipWidth}
      content={<TradeConditionsTooltipBody signal={signal} snapshotConfig={snapshotConfig} />}
    >
      {children}
    </FloatingTooltipTrigger>
  );
}

export function TradeReasonIcon({ signal, preferBelow = false }) {
  const hasReason = splitReasonLines(signal?.tradeDecisionReason).length > 0;
  if (!hasReason) {
    return null;
  }

  return (
    <FloatingTooltipTrigger
      preferBelow={preferBelow}
      tooltipWidth={320}
      content={<ReasonTooltipBody signal={signal} />}
    >
      <span className="signal-icon-button signal-icon-reason" aria-hidden="true">
        i
      </span>
    </FloatingTooltipTrigger>
  );
}

export function TradeDecisionIcon({ signal, snapshotConfig, preferBelow = false }) {
  const status = signal?.tradeDecisionStatus || 'rejected';

  return (
    <TradeConditionsTooltipTrigger
      signal={signal}
      snapshotConfig={snapshotConfig}
      preferBelow={preferBelow}
    >
      <span className={`signal-icon-button signal-icon-trade trade-icon-${status}`} aria-hidden="true">
        💡
      </span>
    </TradeConditionsTooltipTrigger>
  );
}
