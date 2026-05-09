import { NextResponse } from 'next/server';
import { normalizeSignalLimit } from '../../../../src/config/app-config.js';
import {
  readRealtimeSignalSnapshot,
  readSignalSnapshot,
} from '../../../../src/modules/signals/server/signal-query-service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const safeLimit = normalizeSignalLimit(searchParams.get('limit'));
  const mode = searchParams.get('mode') === 'realtime' ? 'realtime' : 'persisted';

  try {
    const snapshot =
      mode === 'realtime'
        ? await readRealtimeSignalSnapshot(safeLimit)
        : await readSignalSnapshot(safeLimit);
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
