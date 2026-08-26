'use client';

export default function LoadingBlock({
  title = '正在同步',
  description = '正在同步最新数据...',
  compact = false,
}) {
  return (
    <div className={`loading-block ${compact ? 'is-compact' : ''}`} role="status" aria-live="polite">
      <div className="loading-spinner" aria-hidden="true" />
      <div className="loading-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
    </div>
  );
}
