export function createScannerExternalService({
  TG_CHAT_ID,
  tgMaxRetries = 2,
  tgRequestTimeoutMs = 20_000,
  tgRetryDelayMs = 1_500,
  TG_TOKEN,
  checkTokenSafetyBase,
  classifyStarsBase,
  commonNoiseWords,
  fetchJson,
  fetchWithEnv,
  fetchTokenDescriptionBase,
  formatCompactPrice,
  formatMomentumAlertBase,
  getGmgnTokenUrl,
  getPriceActionScore,
  getTradeScore,
  gmgnGetBase,
  headers,
  log,
  mapGmgnToken,
  normalizeTheme,
  sleep,
}) {
  const telegramApiUrl = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;

  async function postTelegramMessage(payload) {
    const response = await fetchWithEnv(
      telegramApiUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      tgRequestTimeoutMs
    );

    let result = null;
    try {
      result = await response.json();
    } catch (error) {
      result = {
        ok: false,
        description: `HTTP ${response.status}`,
      };
    }

    return { response, result };
  }

  async function sendTelegramPayload(payload) {
    let lastError = null;

    for (let attempt = 0; attempt <= tgMaxRetries; attempt += 1) {
      try {
        const { response, result } = await postTelegramMessage(payload);

        if (result?.ok) {
          return { ok: true };
        }

        const description = String(result?.description || `HTTP ${response.status}`);
        const normalizedDescription = description.toLowerCase();
        if (normalizedDescription.includes("can't parse")) {
          return {
            ok: false,
            parseError: true,
            error: new Error(description),
          };
        }

        lastError = new Error(description);
        const retryAfterSeconds = Number(result?.parameters?.retry_after || 0);
        const shouldRetry =
          attempt < tgMaxRetries &&
          (response.status >= 500 || response.status === 429 || retryAfterSeconds > 0);

        if (!shouldRetry) {
          break;
        }

        await sleep(retryAfterSeconds > 0 ? retryAfterSeconds * 1_000 : tgRetryDelayMs * (attempt + 1));
      } catch (error) {
        lastError = error;
        if (attempt >= tgMaxRetries) {
          break;
        }
        await sleep(tgRetryDelayMs * (attempt + 1));
      }
    }

    return {
      ok: false,
      error: lastError || new Error('unknown telegram error'),
    };
  }

  async function tgSend(text) {
    if (!TG_TOKEN || !TG_CHAT_ID) {
      log(`[TG] 缺少配置，跳过推送: ${text.slice(0, 60)}`);
      return false;
    }

    const payload = {
      chat_id: TG_CHAT_ID,
      text,
      parse_mode: 'Markdown',
    };

    try {
      const result = await sendTelegramPayload(payload);
      if (result.ok) {
        return true;
      }

      if (result.parseError) {
        const fallbackResult = await sendTelegramPayload({ chat_id: TG_CHAT_ID, text });
        if (fallbackResult.ok) {
          return true;
        }
        log(`[TG] 发送失败(${tgMaxRetries + 1}次): ${fallbackResult.error.message}`);
        return false;
      }

      log(`[TG] 发送失败(${tgMaxRetries + 1}次): ${result.error.message}`);
      return false;
    } catch (error) {
      log(`[TG] 发送异常: ${error.message}`);
      return false;
    }
  }

  async function gmgnGet(url) {
    return gmgnGetBase(url, { fetchJson, headers, sleep });
  }

  async function fetchTokenDescription(chain, address) {
    return fetchTokenDescriptionBase(chain, address, { fetchJson });
  }

  function mapToken(chain, token, overrides = {}) {
    return mapGmgnToken(chain, token, overrides);
  }

  async function checkTokenSafety(chain, address) {
    return checkTokenSafetyBase(chain, address, { fetchJson });
  }

  function classifyStars(token, category, matchedKeywords, descInfo) {
    return classifyStarsBase(token, category, matchedKeywords, descInfo, {
      normalizeTheme,
      noiseWords: commonNoiseWords,
    });
  }

  function formatMomentumAlert(
    token,
    pctGain,
    rounds,
    volUp,
    stars,
    narrativeTag,
    descInfo,
    seenCount,
    scoreOptions = {}
  ) {
    return formatMomentumAlertBase(
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
        ...scoreOptions,
      }
    );
  }

  return {
    checkTokenSafety,
    classifyStars,
    fetchTokenDescription,
    formatMomentumAlert,
    gmgnGet,
    mapToken,
    tgSend,
  };
}
