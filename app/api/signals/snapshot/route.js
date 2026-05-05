import { NextResponse } from 'next/server';
import { getPersistedSignalSnapshot } from '../../../../src/signal-scanner.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rowLimit = Number(searchParams.get('limit') || 60);
  const safeLimit = Number.isFinite(rowLimit) ? Math.min(Math.max(rowLimit, 10), 120) : 60;

  try {
    const snapshot = await getPersistedSignalSnapshot(safeLimit);
    return NextResponse.json(snapshot, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : '读取信号快照失败',
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
