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
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAxisTime(value) {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
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
        min: 1,
        interval: 1,
        splitNumber: Math.min(3, Math.max(1, points.length - 1)),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
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
          data: points.map((item) => ({
            value: item.signalCount,
            ...item,
          })),
        },
      ],
    };
  }, [compact, points]);

  if (!points.length) {
    return <div className="token-timeline-empty">暂无触发时间线</div>;
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  return (
    <div className={`token-timeline-card ${compact ? 'is-compact' : ''}`}>
      <div className="token-timeline-chart-shell">
        <ReactECharts
          option={chartOption}
          notMerge
          lazyUpdate
          opts={{ renderer: 'svg' }}
          style={{ width: '100%', height: compact ? 96 : 118 }}
          className="token-timeline-chart"
        />
      </div>
      <div className="token-timeline-meta">
        <span>首次 {firstPoint.fullLabel}</span>
        <span>最近 {lastPoint.fullLabel}</span>
      </div>
    </div>
  );
}
