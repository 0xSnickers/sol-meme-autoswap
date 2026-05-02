import { NextResponse } from 'next/server';
import {
  getPersistedRadarSnapshot,
  scanNarratives,
} from '../../../../src/trading-radar.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const CACHE_WINDOW_MS = 25_000;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rowLimit = Number(searchParams.get('limit') || 60);
  const safeLimit = Number.isFinite(rowLimit) ? Math.min(Math.max(rowLimit, 10), 120) : 60;

  try {
    const persisted = getPersistedRadarSnapshot(safeLimit);
    const lastScannedAt = persisted.scannedAt ? Date.parse(persisted.scannedAt) : 0;

    if (lastScannedAt && Date.now() - lastScannedAt < CACHE_WINDOW_MS) {
      return NextResponse.json(persisted, {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      });
    }

    const result = await scanNarratives({
      deliver: false,
      rowLimit: safeLimit,
    });

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : '雷达扫描失败',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
}
