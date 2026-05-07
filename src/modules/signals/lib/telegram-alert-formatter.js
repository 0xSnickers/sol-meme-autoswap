export function classifyStars(token, category, matchedKeywords, descInfo, { normalizeTheme, noiseWords } = {}) {
  const isFlap = token.launchpad === 'flap';

  if (category === 'musk_trump') {
    return {
      stars: 3,
      narrativeTag: `马斯克/川普概念 (${matchedKeywords.slice(0, 3).join(', ')})`,
    };
  }

  if (category === 'binance_cz') {
    return {
      stars: 3,
      narrativeTag: `币安/CZ概念 (${matchedKeywords.slice(0, 3).join(', ')})`,
    };
  }

  if (category === 'celebrity_viral') {
    return {
      stars: 2,
      narrativeTag: `名人/热点 (${matchedKeywords.slice(0, 3).join(', ')})`,
    };
  }

  if (isFlap) {
    const communityTags = [];
    if (descInfo.twitter) communityTags.push('有推特');
    if (descInfo.telegram) communityTags.push('有TG群');
    if (descInfo.website) communityTags.push('有官网');

    return {
      stars: communityTags.length > 0 ? 3 : 2,
      narrativeTag: `FLAP社区币${communityTags.length > 0 ? ` | ${communityTags.join(' ')}` : ' | 无社区链接'}`,
    };
  }

  const theme = normalizeTheme(token.name, token.symbol);
  const themeWords = theme
    .split(' ')
    .filter((word) => word.length > 2 && !noiseWords.has(word));

  if (themeWords.length >= 2) {
    return { stars: 2, narrativeTag: `叙事: ${theme}` };
  }

  return { stars: 1, narrativeTag: '无明确叙事' };
}

export function formatMomentumAlert(
  token,
  pctGain,
  rounds,
  volUp,
  stars,
  narrativeTag,
  descInfo,
  seenCount,
  {
    getGmgnTokenUrl,
    getTradeScore,
    getPriceActionScore,
    formatCompactPrice,
    tradeScoreOverride = null,
    priceActionScoreOverride = null,
  } = {}
) {
  const chainMap = { sol: 'SOL', eth: 'ETH', bsc: 'BSC', base: 'BASE' };
  const chainText = chainMap[token.chain] || token.chain.toUpperCase();
  const starText = `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`;
  const volumeTag = volUp ? '放量' : '';
  const gmgnUrl = getGmgnTokenUrl(token.chain, token.address);
  const tradeScore = Number.isFinite(Number(tradeScoreOverride))
    ? Number(tradeScoreOverride)
    : getTradeScore({ token, signalCount: seenCount }).score;
  const priceActionScore = priceActionScoreOverride || getPriceActionScore(token, pctGain, rounds, volUp);
  const priceText = formatCompactPrice(token.price);

  let message = '链上雷达\n';
  message += `链: ${chainText}\n\n`;
  message += `${token.name} (${token.symbol})\n`;
  message += `\`${token.address}\`\n\n`;

  if (descInfo.description) {
    const trimmed = descInfo.description.length > 200 ? `${descInfo.description.slice(0, 200)}...` : descInfo.description;
    message += `故事: ${trimmed}\n\n`;
  }

  message += `叙事: ${narrativeTag}\n`;
  message += `连涨${rounds}轮 +${pctGain.toFixed(1)}% ${volumeTag}\n\n`;
  message += `价格: [$${priceText}](${gmgnUrl})\n`;
  message += `交易评分: ${tradeScore}/100\n`;
  message += `价格评分: ${priceActionScore.score}/100 (${priceActionScore.label})\n\n`;
  message += '```\n';
  message += `市值     $${token.mc.toLocaleString(undefined, { maximumFractionDigits: 0 }).padStart(12)}\n`;
  message += `流动性   $${token.liq.toLocaleString(undefined, { maximumFractionDigits: 0 }).padStart(12)}\n`;
  message += `1h涨幅   ${token.chg_1h >= 0 ? '+' : ''}${token.chg_1h.toFixed(1).padStart(11)}%\n`;
  if (token.sm > 0) {
    message += `聪明钱   ${String(token.sm).padStart(12)}\n`;
  }
  message += `币龄     ${token.age_h.toFixed(1).padStart(10)}h\n`;
  message += '```\n';
  message += `评星: ${starText}  出现次数: ${seenCount}`;

  const links = [];
  if (descInfo.twitter) links.push(`\nTwitter: ${descInfo.twitter}`);
  if (descInfo.telegram) links.push(`TG: ${descInfo.telegram}`);
  if (descInfo.website) links.push(`Web: ${descInfo.website}`);
  if (links.length > 0) message += links.join('\n');

  return message;
}
