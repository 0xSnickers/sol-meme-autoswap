'use client';

function FooterIcon({ kind }) {
  switch (kind) {
    case 'github':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.5 0-.24-.01-1.05-.01-1.9-2.78.62-3.37-1.21-3.37-1.21-.46-1.18-1.11-1.5-1.11-1.5-.9-.63.07-.62.07-.62 1 .08 1.52 1.05 1.52 1.05.88 1.56 2.32 1.11 2.88.85.09-.66.35-1.11.63-1.37-2.22-.26-4.55-1.14-4.55-5.05 0-1.12.39-2.04 1.03-2.77-.1-.26-.45-1.31.1-2.73 0 0 .84-.28 2.75 1.06A9.3 9.3 0 0 1 12 6.82c.85 0 1.71.12 2.51.36 1.9-1.34 2.74-1.06 2.74-1.06.55 1.42.2 2.47.1 2.73.64.73 1.03 1.65 1.03 2.77 0 3.92-2.34 4.79-4.57 5.05.36.32.68.95.68 1.92 0 1.39-.01 2.5-.01 2.84 0 .28.18.61.69.5A10.26 10.26 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z"
          />
        </svg>
      );
    case 'paper':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M21.9 4.6c.3-.8-.5-1.6-1.3-1.3L3.7 9.8c-1 .4-1 1.8 0 2.2l5 2 2 5c.4 1 1.8 1 2.2 0L21.9 4.6Zm-8.2 10.9-1.1 2.9-1.6-4.1 6.4-6.4-3.7 7.6Z"
          />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M18.9 2H22l-6.77 7.74L23 22h-6.1l-4.78-6.26L6.64 22H3.53l7.24-8.27L1 2h6.25l4.32 5.7L18.9 2Zm-1.07 18h1.69L6.33 3.9H4.52Z"
          />
        </svg>
      );
  }
}

export default function AppFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-copy">
        <span className="site-footer-dot" />
        <span>All accumulation is building strength for the future</span>
      </div>
      <div className="site-footer-links">
        <a href="https://github.com/0xSnickers/sol-meme-autoswap" target="_blank" rel="noreferrer" aria-label="GitHub">
          <FooterIcon kind="github" />
        </a>
        <a href="https://gmgn.ai" target="_blank" rel="noreferrer" aria-label="GMGN">
          <FooterIcon kind="paper" />
        </a>
        <a href="https://x.com/search?q=solana%20meme" target="_blank" rel="noreferrer" aria-label="X">
          <FooterIcon kind="x" />
        </a>
      </div>
    </footer>
  );
}
