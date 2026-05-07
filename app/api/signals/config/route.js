import { NextResponse } from 'next/server';
import {
  readPaperTradeSettings,
  readPaperTradeSettingsLockState,
  savePaperTradeSettings,
} from '../../../../src/modules/signals/server/signal-query-service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const paperTradeSettings = await readPaperTradeSettings();
    return NextResponse.json({
      ok: true,
      paperTradeSettings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : '读取策略参数失败',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const payload = await request.json();
    const lockState = await readPaperTradeSettingsLockState();
    if (lockState.locked) {
      return NextResponse.json(
        {
          ok: false,
          error: `当前还有 ${lockState.openCount} 个未平仓持仓，请先清空持仓后再修改止盈止损参数`,
        },
        { status: 400 }
      );
    }

    const paperTradeSettings = await savePaperTradeSettings(payload);

    return NextResponse.json({
      ok: true,
      paperTradeSettings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : '更新策略参数失败',
      },
      { status: 400 }
    );
  }
}
