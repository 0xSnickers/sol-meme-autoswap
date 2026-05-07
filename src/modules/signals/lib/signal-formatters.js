export function formatMoney(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '--';
  }

  return new Intl.NumberFormat('en-US', {
    notation: Number(value) >= 100000 ? 'compact' : 'standard',
    maximumFractionDigits: Number(value) >= 1000 ? 1 : 2,
  }).format(Number(value));
}

export function formatPercent(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '--';
  }

  const number = Number(value);
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
}

export function formatPrice(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '--';
  }

  const number = Number(value);
  const abs = Math.abs(number);
  if (abs >= 1) {
    return `$${number.toFixed(4)}`;
  }
  if (abs >= 0.01) {
    return `$${number.toFixed(6)}`;
  }
  return `$${number.toFixed(8)}`;
}

export function formatLiquidity(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '--';
  }

  const number = Number(value);
  if (number >= 1000000) {
    return `$${(number / 1000000).toFixed(2)}M`;
  }
  if (number >= 1000) {
    return `$${(number / 1000).toFixed(1)}k`;
  }
  return `$${number.toFixed(0)}`;
}

export function formatUsd(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '--';
  }

  const number = Number(value);
  return `${number >= 0 ? '+' : '-'}$${Math.abs(number).toFixed(2)}`;
}

export function formatUsdValue(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '--';
  }

  return `$${Math.abs(Number(value)).toFixed(2)}`;
}

export function formatTime(value) {
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

export function formatCompactTime(value) {
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
  });
}

export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) {
    return '刚启动';
  }

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function formatDecisionLabel(value) {
  switch (value) {
    case 'approved':
      return '允许开仓';
    case 'skipped':
      return '跳过';
    case 'rejected':
      return '不交易';
    default:
      return '--';
  }
}

export function formatTakeProfitSteps(steps = []) {
  return (steps || [])
    .map((step) => `+${step.targetPercent}%/${step.sellPercent}%`)
    .join(' · ');
}
