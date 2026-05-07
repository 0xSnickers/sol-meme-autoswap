import { fetch as undiciFetch, ProxyAgent } from 'undici';

function normalizeProxyMode(value) {
  const mode = String(value || 'auto').trim().toLowerCase();
  if (mode === 'off' || mode === 'false' || mode === '0') {
    return 'off';
  }
  if (mode === 'on' || mode === 'true' || mode === '1') {
    return 'on';
  }
  return 'auto';
}

function getSystemProxyUrl(env) {
  return (
    env.HTTPS_PROXY ||
    env.HTTP_PROXY ||
    env.ALL_PROXY ||
    env.https_proxy ||
    env.http_proxy ||
    env.all_proxy ||
    ''
  );
}

export function resolveOutboundProxyConfig(env = process.env) {
  const proxyMode = normalizeProxyMode(env.SIGNAL_HTTP_PROXY_MODE || env.RADAR_HTTP_PROXY_MODE);
  const explicitProxyUrl = String(
    env.SIGNAL_HTTP_PROXY_URL || env.RADAR_HTTP_PROXY_URL || ''
  ).trim();
  const systemProxyUrl = String(getSystemProxyUrl(env)).trim();

  if (proxyMode === 'off') {
    return {
      proxyEnabled: false,
      proxyMode,
      proxyUrl: '',
    };
  }

  const proxyUrl = explicitProxyUrl || systemProxyUrl;

  return {
    proxyEnabled: Boolean(proxyUrl),
    proxyMode,
    proxyUrl,
  };
}

export function createOutboundHttpClient({ env = process.env, defaultTimeoutMs = 15_000 } = {}) {
  const proxyConfig = resolveOutboundProxyConfig(env);
  const dispatcher = proxyConfig.proxyEnabled ? new ProxyAgent(proxyConfig.proxyUrl) : null;

  async function fetchWithEnv(url, options = {}, timeoutMs = defaultTimeoutMs) {
    const requestOptions = {
      ...options,
    };

    if (!requestOptions.signal) {
      requestOptions.signal = AbortSignal.timeout(timeoutMs);
    }

    if (dispatcher && requestOptions.dispatcher == null) {
      requestOptions.dispatcher = dispatcher;
    }

    return undiciFetch(url, requestOptions);
  }

  async function fetchJson(url, options = {}, timeoutMs = defaultTimeoutMs) {
    const response = await fetchWithEnv(url, options, timeoutMs);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return response.json();
  }

  return {
    ...proxyConfig,
    fetchJson,
    fetchWithEnv,
  };
}
