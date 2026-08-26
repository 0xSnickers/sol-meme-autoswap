import { NextResponse } from 'next/server';
import { closePaperPositions } from '../../../../../src/modules/signals/server/signal-query-service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const payload = await request.json();
    const closeAll = Boolean(payload?.closeAll);
    const positionId = Number(payload?.positionId);

    if (!closeAll && (!Number.isFinite(positionId) || positionId <= 0)) {
      return NextResponse.json(
        {
          ok: false,
          error: '缺少有效的持仓 ID',
        },
        { status: 400 }
      );
    }

    const result = await closePaperPositions(
      closeAll
        ? { closeAll: true }
        : {
            positionIds: [positionId],
          }
    );

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : '平仓失败',
      },
      { status: 400 }
    );
  }
}
