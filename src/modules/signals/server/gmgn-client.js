export async function gmgnGet(url, { fetchJson, headers, sleep, retries = 3 } = {}) {
  let lastReason = 'unknown error';
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const json = await fetchJson(url, { headers });
      return json.data || {};
    } catch (error) {
      lastReason = error instanceof Error ? error.message : String(error);
      if (attempt < retries) await sleep(400 * attempt);
    }
  }

  throw new Error(`GMGN 请求失败(重试${retries}次): ${lastReason}`);
}

export async function fetchTokenDescription(chain, address, { fetchJson } = {}) {
  let description = '';

  if (chain === 'sol' || chain === 'solana') {
    try {
      const json = await fetchJson(`https://frontend-api-v3.pump.fun/coins/${address}`, {}, 8_000);
      return {
        description: (json.description || '').trim(),
        twitter: json.twitter || '',
        telegram: json.telegram || '',
        website: json.website || '',
      };
    } catch {
      // Fall back to DexScreener.
    }
  }

  try {
    const json = await fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {}, 8_000);
    const pairs = json.pairs || [];
    if (pairs.length === 0) return { description, twitter: '', telegram: '', website: '' };

    const info = pairs[0].info || {};
    const socials = info.socials || [];
    const websites = info.websites || [];
    let twitter = '';
    let telegram = '';
    let website = '';

    for (const social of socials) {
      if (social.type === 'twitter') twitter = social.url || '';
      if (social.type === 'telegram') telegram = social.url || '';
    }
    for (const site of websites) {
      if (String(site.label || '').toLowerCase() === 'website') website = site.url || '';
    }

    return { description, twitter, telegram, website };
  } catch {
    return { description, twitter: '', telegram: '', website: '' };
  }
}

export function mapGmgnToken(chain, token, overrides = {}) {
  const marketCap = Number(token.market_cap || token.fdv || 0);
  const liquidity = Number(token.liquidity || 0);
  const openTs = Number(token.open_timestamp || 0);
  const ageHours = openTs > 0 ? (Date.now() / 1000 - openTs) / 3600 : Number.POSITIVE_INFINITY;

  return {
    address: token.address || '',
    chain,
    name: token.name || '?',
    symbol: token.symbol || '?',
    imageUrl:
      token.logo || token.logo_uri || token.logoURI || token.image || token.image_uri ||
      token.imageUrl || token.icon || token.icon_url || '',
    mc: marketCap,
    liq: liquidity,
    volume: Number(token.volume || 0),
    holders: Number(token.holder_count || 0),
    sm: Number(token.smart_degen_count || 0),
    chg_1h: Number(token.price_change_percent1h || 0),
    chg_24h: Number(token.price_change_percent || 0),
    age_h: ageHours,
    price: Number(token.price || 0),
    buys_1h: Number(token.buys || 0),
    sells_1h: Number(token.sells || 0),
    twitter: token.twitter_username || '',
    website: token.website || '',
    telegram: token.telegram || '',
    ...overrides,
  };
}

export async function checkTokenSafety(chain, address, { fetchJson } = {}) {
  if (chain === 'sol' || chain === 'solana') {
    try {
      const json = await fetchJson(`https://api.rugcheck.xyz/v1/tokens/${address}/report`, {}, 10_000);
      const mint = json.mintAuthority;
      const freeze = json.freezeAuthority;
      return {
        safe: !mint && !freeze,
        score: json.score ?? 999,
        mint: mint != null,
        freeze: freeze != null,
      };
    } catch {
      return { safe: false, reason: '无法检查' };
    }
  }

  const chainMap = { ethereum: '1', eth: '1', bsc: '56', base: '8453' };
  const chainId = chainMap[chain] || '1';

  try {
    const json = await fetchJson(
      `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address}`,
      {},
      10_000
    );
    const result = json.result || {};
    const data = result[address.toLowerCase()] || result[address] || {};
    if (!data || Object.keys(data).length === 0) return { safe: false, reason: '无法检查' };

    const honeypot = data.is_honeypot === '1';
    const mintable = data.is_mintable === '1';
    return {
      safe: !honeypot && !mintable,
      honeypot,
      mintable,
      sell_tax: Number(data.sell_tax || 0),
      buy_tax: Number(data.buy_tax || 0),
    };
  } catch {
    return { safe: false, reason: '无法检查' };
  }
}
