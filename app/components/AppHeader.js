'use client';

import Image from 'next/image';
import Link from 'next/link';
import { withAppBasePath } from '../../src/lib/app-path.js';

const NAV_ITEMS = [
  { key: 'pulse', href: '/', label: '最新信号' },
  { key: 'vault', href: '/vault', label: '持仓信息' },
];

function RealtimeStatusIcon({ connected }) {
  if (!connected) {
    return <span className="realtime-status-spinner" aria-hidden="true" />;
  }

  return (
    <svg viewBox="0 0 20 20" className="realtime-status-icon" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10 2.25a7.75 7.75 0 1 0 0 15.5 7.75 7.75 0 0 0 0-15.5Zm3.62 5.65-4.2 4.55a.75.75 0 0 1-1.08.02L6.2 10.38a.75.75 0 1 1 1.05-1.07l1.59 1.56 3.68-3.98a.75.75 0 1 1 1.1 1.01Z"
      />
    </svg>
  );
}

function MiniStatusCard({ label, value, tone = 'neutral' }) {
  const isRealtimeStatus = label === '实时状态';

  return (
    <div className={`mini-status-card ${tone !== 'neutral' ? `is-${tone}` : ''}`}>
      <span>{label}</span>
      <div className="mini-status-value-row">
        {isRealtimeStatus ? <RealtimeStatusIcon connected={tone === 'positive'} /> : null}
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function ChainMiniStatusCard({ label, value, iconSrc, iconAlt, options, onChange }) {
  const selectedOption = options?.find((option) => option.value === value);

  return (
    <div className="mini-status-card network-mini-card">
      <label htmlFor="network-selector">{label}</label>
      <div className="chain-select-wrap">
        <Image
          src={selectedOption?.iconSrc || iconSrc}
          alt={selectedOption?.label || iconAlt}
          width={14}
          height={14}
          className="chain-mini-icon"
        />
        <select
          id="network-selector"
          className="chain-select"
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          aria-label="选择网络"
        >
          {options?.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function AppHeader({ title, navKey, statusCards = [], actions = null }) {
  return (
    <section className="topbar">
      <div className="topbar-left">
        <div className="brand-block">
          <Image
            src={withAppBasePath('/branding/logo.jpg')}
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
            <Link
              key={item.key}
              href={item.href}
              className={`nav-link ${navKey === item.key ? 'active' : ''}`}
              aria-current={navKey === item.key ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
          {actions}
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
              options={item.options}
              onChange={item.onChange}
            />
          ) : (
            <MiniStatusCard key={item.label} label={item.label} value={item.value} tone={item.tone} />
          )
        )}
      </div>
    </section>
  );
}
