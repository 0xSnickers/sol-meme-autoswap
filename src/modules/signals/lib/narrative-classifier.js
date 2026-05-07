const MUSK_TRUMP_KEYWORDS = new Set([
  'musk', 'elon', 'elonmusk', 'spacex', 'starship', 'tesla', 'cybertruck', 'roadster',
  'neuralink', 'boring', 'hyperloop', 'xai', 'grok', 'floki', 'shiba', 'doge father',
  'dogefather', 'technoking', 'mars colony', 'mars', 'trump', 'donald', 'maga', 'potus',
  'trump47', 'melania', 'barron', 'ivanka', 'dark maga', 'darkmaga', 'ultra maga',
  'save america', 'truth social', 'covfefe', 'doge department', 'd.o.g.e',
  'government efficiency',
]);

const MUSK_TRUMP_PATTERNS = [
  /\belon\b/i, /\bmusk\b/i, /\btrump\b/i, /\bmaga\b/i, /\bspacex\b/i,
  /\bstarship\b/i, /\btesla\b/i, /\bgrok\b/i, /\bmelania\b/i, /\bbarron\b/i,
  /\bdoge\s*department\b/i, /\bd\.?o\.?g\.?e\b/i, /\bx\s*ai\b/i, /\bneuralink\b/i,
];

const BINANCE_CZ_KEYWORDS = new Set([
  'cz', 'changpeng', 'zhao', 'czb', 'czbinance', 'heyi', 'yi he', 'he yi', '何一',
  'yihe', 'sister yi', 'yi jie', '一姐', '何一姐', 'binance', 'bnb', 'pancake',
  'pancakeswap', 'giggle academy', 'binance life', 'bnb chain', 'principles', 'cz book',
  'yzi', 'yzi labs', '赵长鹏', '币安', '长鹏', 'cz的', '何一的', 'fourmeme',
  'four meme', '4meme', 'czs dog', 'cz dog', 'bnb dog', 'build on bnb', 'bnb ecosystem',
]);

const BINANCE_CZ_PATTERNS = [
  /\bcz\b/i, /\bbinance\b/i, /\bbnb\b/i, /\bheyi\b/i, /\byi\s*he\b/i,
  /\bhe\s*yi\b/i, /\b何一\b/i, /\b一姐\b/i, /\bpancake\b/i, /\bgiggle\b/i,
  /\byzi\b/i, /\bfourmeme\b/i, /\b4meme\b/i,
];

const CELEBRITY_VIRAL_KEYWORDS = new Set([
  'vitalik', 'buterin', 'sam altman', 'satoshi', 'michael saylor', 'saylor',
  'cathie wood', 'jack dorsey', 'zuckerberg', 'bezos', 'jensen huang', 'nvidia',
  'tim cook', 'justin sun', 'sun yuchen', '孙宇晨', 'tron', 'arthur hayes', 'su zhu',
  '3ac', 'brian armstrong', 'coinbase', 'larry fink', 'blackrock', 'gary gensler',
  'sec', 'michael novogratz', 'galaxy', 'biden', 'obama', 'putin', 'xi jinping',
  'kanye', 'drake', 'snoop dogg', 'paris hilton', 'mark cuban', 'mr beast', 'mrbeast',
  'lobster', '龙虾', 'lobsta', 'hawk tuah', 'griddy', 'skibidi', 'rizz', 'sigma',
  'gyatt', 'etf', 'halving', '减半', 'world war', 'wwiii', 'fed', 'rate cut',
  '降息', 'tiktok ban', 'tiktok',
]);

const CELEBRITY_VIRAL_PATTERNS = [
  /\bvitalik\b/i, /\bsaylor\b/i, /\bblackrock\b/i, /\bcoinbase\b/i,
  /\bjustin\s*sun\b/i, /\blobster\b/i, /\betf\b/i, /\bhalving\b/i,
  /\bmrbeast\b/i, /\bsnoop\b/i, /\bkanye\b/i, /\bdrake\b/i,
];

const SPAM_PATTERNS = [
  /airdrop/i, /presale/i, /pre\s*sale/i, /1000x/i, /100x guaranteed/i,
  /safe\s*moon/i, /baby\s*\w+/i, /pornhub/i, /porn/i, /xxx/i, /nsfw/i,
  /scam/i, /rugpull/i, /rug\s*pull/i, /official\s*token/i, /official\s*coin/i,
];

export function normalizeTheme(name = '', symbol = '') {
  const noise = new Set([
    'token', 'coin', 'inu', 'swap', 'finance', 'protocol', 'dao', 'defi', 'nft',
    'meta', 'verse', 'fi', 'ai', 'pepe', 'wojak', 'chad', 'based',
  ]);

  let text = `${name} ${symbol}`.trim();
  text = text.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  text = text.replace(/\d+x?/g, ' ');
  text = text.replace(/[^a-z\s]/g, ' ');

  const words = text.split(/\s+/).filter((word) => word.length > 1 && !noise.has(word));
  return words.length === 0 ? name.toLowerCase().trim() : [...new Set(words)].sort().join(' ');
}

export function bigramSimilarity(a, b) {
  const toBigrams = (value) => {
    const normalized = ` ${value} `;
    const bigrams = new Map();
    for (let i = 0; i < normalized.length - 1; i += 1) {
      const gram = normalized.slice(i, i + 2);
      bigrams.set(gram, (bigrams.get(gram) || 0) + 1);
    }
    return bigrams;
  };

  const aBigrams = toBigrams(a);
  const bBigrams = toBigrams(b);
  let overlap = 0;
  for (const [gram, count] of aBigrams.entries()) {
    overlap += Math.min(count, bBigrams.get(gram) || 0);
  }

  const total = [...aBigrams.values()].reduce((sum, count) => sum + count, 0) +
    [...bBigrams.values()].reduce((sum, count) => sum + count, 0);
  return total === 0 ? 0 : (2 * overlap) / total;
}

export function isSimilarTheme(theme1, theme2, threshold = 0.7) {
  if (theme1 === theme2 || theme1.includes(theme2) || theme2.includes(theme1)) {
    return true;
  }

  const words1 = new Set(theme1.split(' ').filter(Boolean));
  const words2 = new Set(theme2.split(' ').filter(Boolean));
  const overlap = [...words1].filter((word) => words2.has(word)).length;
  if (words1.size > 0 && words2.size > 0 && overlap / Math.min(words1.size, words2.size) >= 0.6) {
    return true;
  }

  return bigramSimilarity(theme1, theme2) >= threshold;
}

export function classifyNarrative(name, symbol, chain) {
  const text = `${name} ${symbol}`.toLowerCase();

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) return ['spam', null];
  }

  const matchedMt = matchKeywordsAndPatterns(text, MUSK_TRUMP_KEYWORDS, MUSK_TRUMP_PATTERNS);
  if (matchedMt.length > 0 && ['eth', 'ethereum', 'sol', 'solana', 'bsc', 'base'].includes(chain)) {
    return ['musk_trump', matchedMt];
  }

  const matchedBc = matchKeywordsAndPatterns(text, BINANCE_CZ_KEYWORDS, BINANCE_CZ_PATTERNS);
  if (matchedBc.length > 0) {
    return [chain === 'bsc' ? 'binance_cz' : 'binance_cz_wrong_chain', matchedBc];
  }

  const matchedCv = matchKeywordsAndPatterns(text, CELEBRITY_VIRAL_KEYWORDS, CELEBRITY_VIRAL_PATTERNS);
  if (matchedCv.length > 0) {
    return ['celebrity_viral', matchedCv];
  }

  return ['check_novelty', null];
}

function matchKeywordsAndPatterns(text, keywords, patterns) {
  const matched = [...keywords].filter((keyword) => text.includes(keyword.toLowerCase()));
  if (matched.length === 0) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) matched.push(match[0]);
    }
  }
  return matched;
}
