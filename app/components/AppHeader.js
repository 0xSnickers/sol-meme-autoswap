'use client';

import Image from 'next/image';
import Link from 'next/link';

const NAV_ITEMS = [
  { key: 'pulse', href: '/', label: '最新信号' },
  { key: 'vault', href: '/vault', label: '持仓信息' },
  { key: 'intel', href: '/signals', label: '信号统计' },
];

function MiniStatusCard({ label, value, tone = 'neutral' }) {
  const showLoading = label === '实时更新' && typeof value === 'object' && value !== null;
  const progress = showLoading
    ? Math.max(0, Math.min(100, Math.round(((value.total - value.seconds) / value.total) * 100)))
    : 0;

  return (
    <div className={`mini-status-card ${tone !== 'neutral' ? `is-${tone}` : ''}`}>
      <span>{label}</span>
      {showLoading ? (
        <div className="mini-loading-card">
          <strong className="mini-loading-value">Loading {value.seconds}s</strong>
          <div className="mini-loading-track" aria-hidden="true">
            <span className="mini-loading-bar" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : (
        <strong>{value}</strong>
      )}
    </div>
  );
}

function ChainMiniStatusCard({ label, value, iconSrc, iconAlt }) {
  return (
    <div className="mini-status-card network-mini-card">
      <span>{label}</span>
      <strong className="chain-mini-value">
        <Image src={iconSrc} alt={iconAlt} width={14} height={14} className="chain-mini-icon" />
        {value}
      </strong>
    </div>
  );
}

export default function AppHeader({ title, navKey, statusCards = [] }) {
  return (
    <section className="topbar">
      <div className="topbar-left">
        <div className="brand-block">
          <Image
            src="/branding/logo.jpg"
            alt="automated-trading-meme"
            width={48}
            height={48}
            className="brand-logo"
          />
          <div>
            <p className="eyebrow">AUTOMATED TRADING MEME</p>
            <h1>{title}</h1>
          </div>
        </div>

        <div className="page-nav">
          {NAV_ITEMS.map((item) => (
            <Link key={item.key} href={item.href} className={`nav-link ${navKey === item.key ? 'active' : ''}`}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mini-status-grid">
        {statusCards.map((item) =>
          item.iconSrc ? (
            <ChainMiniStatusCard
              key={item.label}
              label={item.label}
              value={item.value}
              iconSrc={item.iconSrc}
              iconAlt={item.iconAlt}
            />
          ) : (
            <MiniStatusCard key={item.label} label={item.label} value={item.value} tone={item.tone} />
          )
        )}
      </div>
    </section>
  );
}
