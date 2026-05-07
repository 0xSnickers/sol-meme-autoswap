'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import * as echarts from 'echarts';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

function formatFullTime(value) {
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

function formatAxisTime(value) {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleTimeString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTradeScore(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '--';
  }

  return `${Math.round(Number(value))}/100`;
}

export function ScoreWithTooltip({ score, signal }) {
  const scoreLabel = formatTradeScore(score);
  const reason = signal?.tradeDecisionReason || '暂无交易判断说明';

  return (
    <span className="position-score-chip" title={reason}>
      评分 {scoreLabel}
    </span>
  );
}

export default function TokenSignalTimeline({ history = [], compact = false }) {
  const points = useMemo(
    () =>
      [...(history || [])]
        .filter((item) => item?.pushedAt)
        .sort((left, right) => new Date(left.pushedAt).getTime() - new Date(right.pushedAt).getTime())
        .map((item, index) => ({
          ...item,
          signalCount: Number(item.signalCount) || index + 1,
          axisLabel: formatAxisTime(item.pushedAt),
          fullLabel: formatFullTime(item.pushedAt),
        })),
    [history]
  );

  const chartOption = useMemo(() => {
    if (!points.length) {
      return null;
    }

    const scoreValues = points
      .map((item) => Number(item.tradeScore))
      .filter((value) => Number.isFinite(value));
    const minScore = scoreValues.length ? Math.min(...scoreValues) : 0;
    const maxScore = scoreValues.length ? Math.max(...scoreValues) : 100;
    const scoreRange = Math.max(1, maxScore - minScore);
    const interval = compact ? (scoreRange <= 20 ? 20 : 25) : scoreRange <= 30 ? 15 : 20;
    const axisMin = Math.max(0, Math.floor(minScore / interval) * interval - interval);
    const axisMax = Math.min(100, Math.ceil(maxScore / interval) * interval + interval);

    return {
      animation: false,
      backgroundColor: 'transparent',
      grid: {
        left: compact ? 8 : 12,
        right: compact ? 8 : 12,
        top: compact ? 8 : 12,
        bottom: compact ? 26 : 30,
        containLabel: true,
      },
      tooltip: {
        trigger: 'axis',
        appendToBody: true,
        confine: false,
        backgroundColor: 'rgba(10, 12, 16, 0.96)',
        borderColor: 'rgba(141, 248, 71, 0.22)',
        extraCssText: 'max-width: 220px; white-space: normal; box-shadow: 0 14px 30px rgba(0, 0, 0, 0.35);',
        textStyle: {
          color: '#f2f5f7',
          fontSize: 12,
        },
        formatter(params) {
          const item = params?.[0]?.data;
          if (!item) {
            return '';
          }

          const priceLabel =
            item.price == null || Number.isNaN(Number(item.price))
              ? '--'
              : `$${Number(item.price).toFixed(Number(item.price) >= 1 ? 4 : 8)}`;

          return [
            `${item.fullLabel}`,
            `第 ${item.signalCount} 次触发`,
            `价格 ${priceLabel}`,
            `评分 ${formatTradeScore(item.tradeScore)}`,
          ].join('<br/>');
        },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: points.map((item) => item.axisLabel),
        axisLine: {
          lineStyle: { color: 'rgba(255, 255, 255, 0.12)' },
        },
        axisTick: { show: false },
        axisLabel: {
          color: 'rgba(255, 255, 255, 0.56)',
          fontSize: compact ? 10 : 11,
          interval: 'auto',
          hideOverlap: true,
        },
      },
      yAxis: {
        type: 'value',
        min: axisMin,
        max: axisMax,
        interval,
        splitNumber: compact ? 2 : 3,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: 'rgba(255, 255, 255, 0.56)',
          fontSize: compact ? 10 : 11,
          margin: compact ? 10 : 14,
          formatter(value) {
            return `${Math.round(Number(value))}`;
          },
        },
        splitLine: {
          lineStyle: { color: 'rgba(255, 255, 255, 0.05)' },
        },
      },
      series: [
        {
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: compact ? 6 : 7,
          showSymbol: true,
          lineStyle: {
            width: 2.2,
            color: '#8df847',
          },
          itemStyle: {
            color: '#8df847',
            borderColor: '#d9ffb8',
            borderWidth: 1.5,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(141, 248, 71, 0.28)' },
              { offset: 1, color: 'rgba(141, 248, 71, 0.02)' },
            ]),
          },
          emphasis: {
            focus: 'series',
          },
          label: compact
            ? { show: false }
            : {
                show: true,
                position: 'top',
                distance: 8,
                color: 'rgba(242, 245, 247, 0.92)',
                fontSize: 10,
                formatter(params) {
                  const score = params?.data?.tradeScore;
                  if (score == null || Number.isNaN(Number(score))) {
                    return '';
                  }
                  return `${Math.round(Number(score))}`;
                },
              },
          data: points.map((item) => ({
            value: Number(item.tradeScore ?? 0),
            ...item,
          })),
        },
      ],
    };
  }, [compact, points]);

  if (!points.length) {
    return <div className="token-timeline-empty">暂无触发时间线</div>;
  }
  return (
    <div className={`token-timeline-card ${compact ? 'is-compact' : ''}`}>
      <div className="token-timeline-chart-shell">
        <ReactECharts
          option={chartOption}
          notMerge
          lazyUpdate
          opts={{ renderer: 'svg' }}
          style={{ width: '100%', height: compact ? 138 : 182 }}
          className="token-timeline-chart"
        />
      </div>
    </div>
  );
}
