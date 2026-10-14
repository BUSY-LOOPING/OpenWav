import crypto from 'node:crypto';
import { EVENTS_TOPIC } from '@openwav/shared';
import { counter } from '@openwav/shared/metrics';

const accepted = counter('tracking_events_total', 'Tracking events by outcome', ['type', 'outcome']);

export function createEventService({ prisma, settings, producer, logger, random = Math.random }) {
  async function applyHistory(userId, e) {
    if (!e.mediaId) return;
    const position = Math.round(e.positionSec ?? 0);
    if (e.type === 'play_start') {
      await prisma.$transaction([
        prisma.userHistory.upsert({
          where: { userId_mediaId: { userId, mediaId: e.mediaId } },
          create: { userId, mediaId: e.mediaId, totalDuration: e.durationSec ? Math.round(e.durationSec) : null },
          update: { playCount: { increment: 1 }, playedAt: new Date(), completed: false },
        }),
        prisma.media.update({ where: { id: e.mediaId }, data: { playCount: { increment: 1 } } }),
      ]);
    } else if (e.type === 'play_progress') {
      await prisma.userHistory.updateMany({ where: { userId, mediaId: e.mediaId }, data: { lastPosition: position, watchTime: { increment: 30 } } });
    } else if (e.type === 'play_complete') {
      await prisma.userHistory.updateMany({ where: { userId, mediaId: e.mediaId }, data: { completed: true, lastPosition: 0 } });
    }
  }

  return {
    async ingest(userId, events) {
      const s = await settings.all();
      const enabled = new Set(s['events.types']);
      const kept = [];
      for (const e of events) {
        if (e.type.startsWith('play_')) await applyHistory(userId, e).catch((err) => logger.warn({ err }, 'history update failed'));
        if (!s['events.enabled'] || !enabled.has(e.type)) {
          accepted.inc({ type: e.type, outcome: 'disabled' });
        } else if (random() >= s['events.sample_rate']) {
          accepted.inc({ type: e.type, outcome: 'sampled_out' });
        } else {
          kept.push({ eventId: crypto.randomUUID(), userId, ...e, occurredAt: e.occurredAt ?? new Date().toISOString() });
        }
      }
      if (!kept.length) return 0;
      try {
        await producer.send({ topic: EVENTS_TOPIC, messages: kept.map((e) => ({ key: userId, value: JSON.stringify(e) })) });
        kept.forEach((e) => accepted.inc({ type: e.type, outcome: 'produced' }));
      } catch (err) {
        kept.forEach((e) => accepted.inc({ type: e.type, outcome: 'failed' }));
        logger.warn({ err }, 'event produce failed');
      }
      return kept.length;
    },
  };
}
