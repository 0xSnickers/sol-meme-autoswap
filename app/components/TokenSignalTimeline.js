'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import * as echarts from 'echarts';
import { TradeConditionsTooltipTrigger } from './TradeConditionsTooltip';

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

function formatTimeAxisLabel(value, compact = false) {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  return date.toLocaleTimeString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    ...(compact ? {} : { second: '2-digit' }),
  });
}

function formatScore(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '--';
  }

  return `${Math.round(Number(value))}/100`;
}

export function ScoreWithTooltip({ score, signal, snapshotConfig, preferBelow = false }) {
  const scoreLabel = formatScore(score);

  return (
    <TradeConditionsTooltipTrigger
      signal={signal}
      snapshotConfig={snapshotConfig}
      preferBelow={preferBelow}
    >
      <span className="position-score-chip">评分 {scoreLabel}</span>
    </TradeConditionsTooltipTrigger>
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
          timestamp: new Date(item.pushedAt).getTime(),
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
      .flatMap((item) => [Number(item.tradeScore), Number(item.priceScore)])
      .filter((value) => Number.isFinite(value));
    const minScore = scoreValues.length ? Math.min(...scoreValues) : 0;
    const maxScore = scoreValues.length ? Math.max(...scoreValues) : 100;
    const scoreRange = Math.max(1, maxScore - minScore);
    const densePoints = points.length >= 10;
    const showPointSymbols = points.length <= (compact ? 10 : 14);
    const interval = compact ? (scoreRange <= 20 ? 20 : 25) : scoreRange <= 30 ? 15 : 20;
    const axisMin = Math.max(0, Math.floor(minScore / interval) * interval - interval);
    const axisMax = Math.min(100, Math.ceil(maxScore / interval) * interval + interval);

    return {
      animation: false,
      backgroundColor: 'transparent',
      grid: {
        left: compact ? 8 : 12,
        right: compact ? 8 : 12,
        top: compact ? 10 : 12,
        bottom: compact ? 26 : 30,
        containLabel: true,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          snap: true,
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.18)',
            width: 1,
          },
        },
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
          const item = params?.find((param) => param?.data)?.data;
          if (!item) {
            return '';
          }

          const tradeParam = params?.find((param) => param?.seriesName === '交易评分');
          const priceParam = params?.find((param) => param?.seriesName === '价格评分');

          const priceLabel =
            item.price == null || Number.isNaN(Number(item.price))
              ? '--'
              : `$${Number(item.price).toFixed(Number(item.price) >= 1 ? 4 : 8)}`;

          return [
            `${item.fullLabel}`,
            `第 ${item.signalCount} 次触发`,
            `价格 ${priceLabel}`,
            `${tradeParam?.marker || ''}交易评分 ${formatScore(item.tradeScore)}`,
            `${priceParam?.marker || ''}价格评分 ${formatScore(item.priceScore)}`,
          ].join('<br/>');
        },
      },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        axisLine: {
          lineStyle: { color: 'rgba(255, 255, 255, 0.12)' },
        },
        axisTick: { show: false },
        splitNumber: compact ? 3 : 5,
        axisLabel: {
          color: 'rgba(255, 255, 255, 0.56)',
          fontSize: compact ? 10 : 11,
          hideOverlap: true,
          formatter(value) {
            return formatTimeAxisLabel(value, compact);
          },
        },
        splitLine: {
          show: false,
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
          name: '交易评分',
          type: 'line',
          smooth: densePoints ? false : 0.22,
          smoothMonotone: 'x',
          symbol: 'circle',
          symbolSize: showPointSymbols ? (compact ? 5 : 6) : 4,
          showSymbol: showPointSymbols,
          connectNulls: false,
          clip: true,
          lineStyle: {
            width: densePoints ? 2.2 : 2.6,
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
          markLine: compact
            ? undefined
            : {
                symbol: 'none',
                label: { show: false },
                lineStyle: {
                  color: 'rgba(141, 248, 71, 0.18)',
                  type: 'solid',
                  width: 1,
                },
                data: [{ yAxis: 65 }],
              },
          markArea: {
            silent: true,
            itemStyle: {
              borderWidth: 0,
            },
            data: [
              [
                {
                  yAxis: 0,
                  itemStyle: { color: 'rgba(255, 99, 132, 0.055)' },
                },
                { yAxis: 50 },
              ],
              [
                {
                  yAxis: 50,
                  itemStyle: { color: 'rgba(255, 184, 77, 0.045)' },
                },
                { yAxis: 65 },
              ],
              [
                {
                  yAxis: 65,
                  itemStyle: { color: 'rgba(94, 234, 212, 0.04)' },
                },
                { yAxis: 80 },
              ],
              [
                {
                  yAxis: 80,
                  itemStyle: { color: 'rgba(141, 248, 71, 0.045)' },
                },
                { yAxis: 100 },
              ],
            ],
          },
          label: { show: false },
          data: points.map((item) => ({
            value:
              item.tradeScore == null || Number.isNaN(Number(item.tradeScore))
                ? [item.timestamp, null]
                : [item.timestamp, Number(item.tradeScore)],
            ...item,
          })),
        },
        {
          name: '价格评分',
          type: 'line',
          smooth: densePoints ? false : 0.18,
          smoothMonotone: 'x',
          symbol: 'diamond',
          symbolSize: showPointSymbols ? (compact ? 5 : 6) : 4,
          showSymbol: showPointSymbols,
          connectNulls: false,
          clip: true,
          lineStyle: {
            width: densePoints ? 1.8 : 2,
            color: '#5eead4',
            opacity: densePoints ? 0.75 : 0.88,
          },
          itemStyle: {
            color: '#5eead4',
            borderColor: '#ccfbf1',
            borderWidth: 1.5,
          },
          areaStyle: {
            color: 'rgba(94, 234, 212, 0.035)',
          },
          emphasis: {
            focus: 'series',
          },
          markLine: compact
            ? undefined
            : {
                symbol: 'none',
                label: { show: false },
                lineStyle: {
                  color: 'rgba(94, 234, 212, 0.18)',
                  type: 'dashed',
                  width: 1,
                },
                data: [{ yAxis: 50 }],
              },
          label: { show: false },
          data: points.map((item) => ({
            value:
              item.priceScore == null || Number.isNaN(Number(item.priceScore))
                ? [item.timestamp, null]
                : [item.timestamp, Number(item.priceScore)],
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
          style={{ width: '100%', height: compact ? 148 : 204 }}
          className="token-timeline-chart"
        />
      </div>
    </div>
  );
}
