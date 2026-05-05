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
      return <img src="/branding/x.jpg" alt="" className="brand-icon-image" />;
    case 'gmgn':
      return <img src="/branding/gmgn.jpg" alt="" className="brand-icon-image" />;
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

export function ExternalLinks({ address, twitter }) {
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
    </div>
  );
}
