import { PROGRESS_CHANNEL } from '@openwav/shared';
import { gauge } from '@openwav/shared/metrics';

const connections = gauge('sse_connections', 'Open progress SSE connections');

export function createProgressHub({ subscriber, logger }) {
  const listeners = new Map();

  subscriber?.subscribe(PROGRESS_CHANNEL).catch((err) => logger.error({ err }, 'progress subscribe failed'));
  subscriber?.on('message', (_channel, message) => hub.dispatch(message));

  const hub = {
    dispatch(message) {
      let event;
      try {
        event = JSON.parse(message);
      } catch {
        return;
      }
      const { userId, ...payload } = event;
      for (const res of listeners.get(userId) ?? []) res.write(`data: ${JSON.stringify(payload)}\n\n`);
    },
    attach(userId, req, res) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 3000\n\n');
      if (!listeners.has(userId)) listeners.set(userId, new Set());
      listeners.get(userId).add(res);
      connections.inc();
      const heartbeat = setInterval(() => res.write(': ping\n\n'), 15_000);
      req.on('close', () => {
        clearInterval(heartbeat);
        listeners.get(userId)?.delete(res);
        if (!listeners.get(userId)?.size) listeners.delete(userId);
        connections.dec();
      });
    },
    size: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
  };
  return hub;
}
