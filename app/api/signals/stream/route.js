import { getRealtimeSignalSnapshot } from '../../../../src/signal-scanner.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STREAM_INTERVAL_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 15_000;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rowLimit = Number(searchParams.get('limit') || 60);
  const safeLimit = Number.isFinite(rowLimit) ? Math.min(Math.max(rowLimit, 10), 120) : 60;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let pushing = false;
      let streamTimer = null;
      let heartbeatTimer = null;

      const safeEnqueue = (payload) => {
        if (closed) {
          return false;
        }

        try {
          controller.enqueue(payload);
          return true;
        } catch {
          closed = true;
          return false;
        }
      };

      const cleanup = () => {
        if (closed) {
          return;
        }
        closed = true;
        if (streamTimer) {
          clearInterval(streamTimer);
        }
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
        }
        try {
          controller.close();
        } catch {
          // Ignore double-close errors.
        }
      };

      const pushSnapshot = async () => {
        if (closed || pushing) {
          return;
        }

        pushing = true;
        try {
          const snapshot = await getRealtimeSignalSnapshot(safeLimit);
          safeEnqueue(encoder.encode(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`));
        } catch (error) {
          safeEnqueue(
            encoder.encode(
              `event: stream-error\ndata: ${JSON.stringify({
                error: error instanceof Error ? error.message : '实时推送失败',
              })}\n\n`
            )
          );
        } finally {
          pushing = false;
        }
      };

      void pushSnapshot();
      streamTimer = setInterval(() => {
        void pushSnapshot();
      }, STREAM_INTERVAL_MS);
      heartbeatTimer = setInterval(() => {
        safeEnqueue(encoder.encode(': heartbeat\n\n'));
      }, HEARTBEAT_INTERVAL_MS);

      request.signal.addEventListener('abort', cleanup);
    },
    cancel() {
      // Client disconnected.
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
