'use client';

import { useEffect, useMemo, useState } from 'react';

export default function VirtualListTable({
  items,
  rowHeight,
  height,
  headers,
  headerClassName = '',
  rowClassName = '',
  minTableWidth,
  getItemKey,
  renderRow,
}) {
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    setScrollTop(0);
  }, [items.length]);

  const { startIndex, endIndex, visibleItems, totalHeight } = useMemo(() => {
    const overscan = 4;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleCount = Math.ceil(height / rowHeight) + overscan * 2;
    const end = Math.min(items.length, start + visibleCount);

    return {
      startIndex: start,
      endIndex: end,
      visibleItems: items.slice(start, end),
      totalHeight: items.length * rowHeight,
    };
  }, [height, items, rowHeight, scrollTop]);

  return (
    <div className="virtual-shell">
      <div className="virtual-table" style={minTableWidth ? { minWidth: minTableWidth } : undefined}>
        <div className={`virtual-header ${headerClassName}`.trim()}>
          {headers.map((header) => (
            <div key={header.key} className="virtual-head-cell">
              {header.label}
            </div>
          ))}
        </div>

        <div className="virtual-viewport" style={{ height }} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
          <div className="virtual-spacer" style={{ height: totalHeight }}>
            {visibleItems.map((item, index) => {
              const actualIndex = startIndex + index;
              return (
                <div
                  key={getItemKey(item)}
                  className="virtual-row"
                  style={{ height: rowHeight, transform: `translateY(${actualIndex * rowHeight}px)` }}
                >
                  <div className={`virtual-row-inner ${rowClassName}`.trim()}>
                    {renderRow(item, actualIndex)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="virtual-footer">
          显示 {items.length === 0 ? 0 : startIndex + 1}-{endIndex} / {items.length}
        </div>
      </div>
    </div>
  );
}
