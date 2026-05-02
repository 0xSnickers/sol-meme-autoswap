'use client';

export default function LoadingBlock({ title = 'Loading', description = '正在同步最新数据...' }) {
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <div className="loading-spinner" />
      <div className="loading-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
    </div>
  );
}
