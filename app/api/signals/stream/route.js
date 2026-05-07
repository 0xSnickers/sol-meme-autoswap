import { APP_CONFIG, normalizeSignalLimit } from '../../../../src/config/app-config.js';
import { readRealtimeSignalSnapshot } from '../../../../src/modules/signals/server/signal-query-service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const safeLimit = normalizeSignalLimit(searchParams.get('limit'));
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
          const snapshot = await readRealtimeSignalSnapshot(safeLimit);
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
      }, APP_CONFIG.signals.streamIntervalMs);
      heartbeatTimer = setInterval(() => {
        safeEnqueue(encoder.encode(': heartbeat\n\n'));
      }, APP_CONFIG.signals.heartbeatIntervalMs);

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
