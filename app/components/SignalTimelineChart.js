'use client';

import dynamic from 'next/dynamic';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

function formatPrice(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '--';
  }

  const number = Number(value);
  if (Math.abs(number) >= 1) {
    return `$${number.toFixed(4)}`;
  }
  if (Math.abs(number) >= 0.01) {
    return `$${number.toFixed(6)}`;
  }
  return `$${number.toFixed(8)}`;
}

export default function SignalTimelineChart({ timeline = [] }) {
  if (!timeline.length) {
    return <div className="empty-state compact-empty">当前还没有可展示的信号时间线。</div>;
  }

  const option = {
    backgroundColor: 'transparent',
    animation: false,
    grid: {
      left: 24,
      right: 16,
      top: 18,
      bottom: 28,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(13, 15, 18, 0.96)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      textStyle: {
        color: '#f2f5f7',
      },
      formatter(params) {
        const point = params?.[0]?.data?.raw;
        if (!point) {
          return '';
        }

        return [
          point.timeLabel,
          `${point.name || point.symbol || '未知 Token'} · #${point.signalCount}`,
          `累计信号 ${point.cumulativeCount}`,
          `价格 ${formatPrice(point.price)}`,
        ].join('<br/>');
      },
    },
    xAxis: {
      type: 'time',
      axisLine: {
        lineStyle: { color: 'rgba(255,255,255,0.12)' },
      },
      axisLabel: {
        color: '#9aa4b2',
      },
      splitLine: {
        show: false,
      },
    },
    yAxis: {
      type: 'value',
      name: '累计信号',
      nameTextStyle: {
        color: '#9aa4b2',
      },
      axisLine: {
        show: false,
      },
      axisLabel: {
        color: '#9aa4b2',
      },
      splitLine: {
        lineStyle: { color: 'rgba(255,255,255,0.06)' },
      },
    },
    series: [
      {
        type: 'line',
        smooth: false,
        showSymbol: true,
        symbolSize: 7,
        data: timeline.map((item) => ({
          value: [item.time, item.cumulativeCount],
          raw: {
            ...item,
            timeLabel: new Date(item.time).toLocaleString('zh-CN', { hour12: false }),
          },
        })),
        lineStyle: {
          width: 2,
          color: '#8df847',
        },
        itemStyle: {
          color: '#8df847',
          borderColor: '#d9ffb8',
          borderWidth: 1,
        },
        areaStyle: {
          color: 'rgba(141, 248, 71, 0.08)',
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 320, width: '100%' }} notMerge lazyUpdate />;
}
