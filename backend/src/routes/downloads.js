import { AUDIO_FORMATS, AUDIO_QUALITIES, trackingEventSchema } from '@openwav/shared';
import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../lib/errors.js';
import { cursorWhere, page, pageQuery, uuidParam, validate } from '../lib/http.js';

export function downloadRoutes({ prisma, auth, serialize, downloads, limits, tokens, progress, events }) {
  const router = Router();

  router.post(
    '/downloads',
    auth.authenticate,
    limits.downloads,
    validate({ body: z.object({ url: z.string().url().max(1000), format: z.enum(AUDIO_FORMATS).optional(), quality: z.enum(AUDIO_QUALITIES).optional(), playlistId: z.string().uuid().optional() }) }),
    async (req, res) => {
      const result = await downloads.create({ ...req.body, userId: req.user.id });
      events.ingest(req.user.id, [{ type: 'download_request' }]).catch(() => {});
      res.status(result.mediaId ? 200 : 202).json({ data: result });
    },
  );

  router.get('/downloads', auth.authenticate, validate({ query: pageQuery }), async (req, res) => {
    const { cursor, limit } = req.query;
    const rows = await prisma.downloadTask.findMany({
      where: { requestedBy: req.user.id, ...cursorWhere(cursor) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { media: { select: { title: true } } },
    });
    const { items, nextCursor } = page(rows, limit);
    res.json({ data: items.map(serialize.task), nextCursor });
  });

  router.get('/downloads/:id', auth.authenticate, validate({ params: uuidParam }), async (req, res) => {
    const task = await prisma.downloadTask.findFirst({ where: { id: req.params.id, requestedBy: req.user.id }, include: { media: { select: { title: true } } } });
    if (!task) throw notFound('Download');
    res.json({ data: serialize.task(task) });
  });

  router.post('/tickets', auth.authenticate, validate({ body: z.object({ purpose: z.enum(['progress']) }) }), (req, res) => {
    res.status(201).json({ data: tokens.signTicket(req.user.id, req.body.purpose) });
  });

  router.get('/progress', validate({ query: z.object({ ticket: z.string().min(1).max(2000) }) }), (req, res) => {
    progress.attach(tokens.verifyTicket(req.query.ticket, 'progress'), req, res);
  });

  router.post('/events', auth.authenticate, validate({ body: z.object({ events: z.array(trackingEventSchema).min(1).max(50) }) }), async (req, res) => {
    const accepted = await events.ingest(req.user.id, req.body.events);
    res.status(202).json({ data: { accepted } });
  });

  return router;
}
