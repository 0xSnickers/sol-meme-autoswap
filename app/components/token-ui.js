'use client';

import { useEffect, useState } from 'react';

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

export function TokenAvatar({ name, symbol, imageUrl, size = 'md' }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(imageUrl) && !imageFailed;
  const fallbackText = String(symbol || name || '?').slice(0, 1).toUpperCase();

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <span className={`token-avatar token-avatar-${size}`}>
      {hasImage ? (
        <img
          src={imageUrl}
          alt={name ? `${name} logo` : 'token logo'}
          className="token-avatar-image"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="token-avatar-fallback">{fallbackText}</span>
      )}
    </span>
  );
}

export function AddressCopy({ address, copyId, copiedKey, onCopy }) {
  return (
    <div className="ca-row">
      <span className="ca-text">{formatAddress(address)}</span>
      <button type="button" className="copy-btn copy-btn-mini" onClick={() => onCopy(address, copyId)} aria-label="复制 CA">
        {copiedKey === copyId ? '✓' : '⧉'}
      </button>
    </div>
  );
}

export function ExternalLinks({ address, twitter, className = '' }) {
  return (
    <div className={`icon-links ${className}`.trim()}>
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
