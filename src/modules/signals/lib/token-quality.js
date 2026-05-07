export const COMMON_NOISE_WORDS = new Set([
  'nice', 'good', 'bad', 'cool', 'hot', 'big', 'small', 'life', 'love', 'hate',
  'happy', 'sad', 'fun', 'lol', 'cat', 'dog', 'moon', 'sun', 'star', 'king',
  'queen', 'gold', 'rich', 'cash', 'money', 'pay', 'buy', 'sell', 'pump', 'dump',
  'bull', 'bear', 'green', 'red', 'hello', 'world', 'yes', 'no', 'wow', 'omg',
  'lmao', 'simp', 'chad', 'based', 'cope', 'seethe', 'test', 'new', 'old',
  'real', 'fake', 'shit', 'shitcoin', 'fuck', 'fart', 'poop', 'pee', 'cum',
  'dick', 'ass', 'boob', 'tit', 'retard', 'slop', 'the', 'and', 'for', 'from',
  'with', 'this', 'that', 'coin', 'token', 'meme', 'pepe', 'wojak', 'peg', 'usd',
  'usdt', 'usdc', 'dai',
]);

export function hasAnySocial(token = {}, descInfo = {}) {
  return Boolean(
    token.twitter || token.website || token.telegram || descInfo.twitter || descInfo.website || descInfo.telegram
  );
}

export function getBuySellMetrics(token = {}) {
  const buyCount = token.buys_1h || token.buys || 0;
  const sellCount = token.sells_1h || token.sells || 0;
  const buySellRatio = buyCount / Math.max(sellCount, 1);
  return { buyCount, sellCount, buySellRatio };
}

export function getPushQualityResult(
  token,
  descInfo = {},
  {
    pushMinLiquidity,
    pushMinHolders,
    pushMinVolume,
    pushMinBuySellRatio,
    requireSocials,
  }
) {
  const reasons = [];
  const { buyCount, sellCount, buySellRatio } = getBuySellMetrics(token);

  if (token.liq < pushMinLiquidity) reasons.push(`流动性低于 ${pushMinLiquidity}`);
  if (token.holders < pushMinHolders) reasons.push(`持有人低于 ${pushMinHolders}`);
  if (token.volume < pushMinVolume) reasons.push(`1h成交量低于 ${pushMinVolume}`);
  if (buyCount <= sellCount || buySellRatio < pushMinBuySellRatio) {
    reasons.push(`买卖比低于 ${pushMinBuySellRatio}`);
  }
  if (requireSocials && !hasAnySocial(token, descInfo)) reasons.push('缺少社交或官网链接');

  return {
    pass: reasons.length === 0,
    reasons,
    buyCount,
    sellCount,
    buySellRatio,
    hasSocials: hasAnySocial(token, descInfo),
  };
}

export function passesPushQualityGate(token, descInfo, options) {
  return getPushQualityResult(token, descInfo, options).pass;
}
