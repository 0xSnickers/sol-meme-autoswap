'use client';

export function formatAddress(value) {
  if (!value) {
    return '--';
  }

  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function formatXLabel(url) {
  if (!url) {
    return 'X';
  }

  try {
    const { pathname } = new URL(url);
    const clean = pathname.replace(/^\/+/, '');
    return clean ? `X/${clean}` : 'X';
  } catch {
    return 'X';
  }
}

export function LinkIcon({ kind }) {
  switch (kind) {
    case 'x':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M18.9 2H22l-6.77 7.74L23 22h-6.1l-4.78-6.26L6.64 22H3.53l7.24-8.27L1 2h6.25l4.32 5.7L18.9 2Zm-1.07 18h1.69L6.33 3.9H4.52Z"
          />
        </svg>
      );
    case 'telegram':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M9.78 15.42 9.4 20.8c.54 0 .78-.23 1.06-.51l2.54-2.42 5.27 3.86c.97.53 1.65.25 1.91-.89l3.46-16.2h.01c.31-1.45-.52-2.01-1.47-1.66L2.03 10.74c-1.38.54-1.36 1.31-.24 1.66l5.15 1.6L18.9 6.5c.56-.34 1.07-.15.65.2"
          />
        </svg>
      );
    case 'website':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.93 9h-3.11a15.5 15.5 0 0 0-1.38-5.02A8.03 8.03 0 0 1 18.93 11ZM12 4.04c.82 1.12 1.9 3.48 2.21 6.96H9.79C10.1 7.52 11.18 5.16 12 4.04ZM4.06 13h3.11c.16 1.83.64 3.56 1.37 5.02A8.03 8.03 0 0 1 4.06 13Zm3.11-2H4.06a8.03 8.03 0 0 1 4.48-5.02A15.5 15.5 0 0 0 7.17 11Zm4.83 8.96c-.82-1.12-1.9-3.48-2.21-6.96h4.42c-.31 3.48-1.39 5.84-2.21 6.96ZM14.83 13h3.11a8.03 8.03 0 0 1-4.48 5.02A15.5 15.5 0 0 0 14.83 13Z"
          />
        </svg>
      );
    case 'gmgn':
      return <span className="link-letter">G</span>;
    case 'dex':
      return <span className="link-letter">D</span>;
    default:
      return <span className="link-letter">?</span>;
  }
}

export function AddressCopy({ address, copyId, copiedKey, onCopy }) {
  return (
    <div className="ca-row">
      <span className="ca-text">{formatAddress(address)}</span>
      <button type="button" className="copy-btn" onClick={() => onCopy(address, copyId)}>
        {copiedKey === copyId ? '已复制' : '复制'}
      </button>
    </div>
  );
}

export function ExternalLinks({ address, twitter, website, telegram, gmgnOnly = false, xOnly = false }) {
  return (
    <div className="icon-links">
      {twitter ? (
        <a
          href={twitter}
          target="_blank"
          rel="noreferrer"
          className="icon-link"
          title={formatXLabel(twitter)}
          aria-label="X"
        >
          <LinkIcon kind="x" />
        </a>
      ) : null}
      {!gmgnOnly && !xOnly && website ? (
        <a href={website} target="_blank" rel="noreferrer" className="icon-link" title="官网" aria-label="官网">
          <LinkIcon kind="website" />
        </a>
      ) : null}
      {!gmgnOnly && !xOnly && telegram ? (
        <a href={telegram} target="_blank" rel="noreferrer" className="icon-link" title="Telegram" aria-label="Telegram">
          <LinkIcon kind="telegram" />
        </a>
      ) : null}
      {address ? (
        <a
          href={`https://gmgn.ai/sol/token/${address}`}
          target="_blank"
          rel="noreferrer"
          className="icon-link"
          title="GMGN"
          aria-label="GMGN"
        >
          <LinkIcon kind="gmgn" />
        </a>
      ) : null}
      {!gmgnOnly && !xOnly && address ? (
        <a
          href={`https://dexscreener.com/solana/${address}`}
          target="_blank"
          rel="noreferrer"
          className="icon-link"
          title="Dexscreener"
          aria-label="Dexscreener"
        >
          <LinkIcon kind="dex" />
        </a>
      ) : null}
    </div>
  );
}
