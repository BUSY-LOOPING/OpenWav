import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { badRequest, conflict, forbidden, unauthorized } from '../lib/errors.js';
import { validate } from '../lib/http.js';

const password = z.string().min(8).max(128).regex(/[A-Za-z]/, 'Password needs a letter').regex(/\d/, 'Password needs a digit');
const username = z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/, 'Username may use letters, numbers, _ and -');
const email = z.string().trim().toLowerCase().email().max(255);

export function authRoutes({ prisma, tokens, config, settings, serialize, auth, limits }) {
  const router = Router();

  async function issue(user, res, status = 200) {
    const refresh = tokens.newRefresh();
    await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: refresh.hash, expiresAt: refresh.expiresAt } });
    res.status(status).json({ data: { user: serialize.user(user), tokens: { accessToken: tokens.signAccess(user), refreshToken: refresh.token } } });
  }

  router.post('/register', limits.auth, validate({ body: z.object({ username, email, password }) }), async (req, res) => {
    if (!(await settings.get('auth.registration_enabled'))) throw forbidden('Registration is disabled');
    const { username: name, email: mail } = req.body;
    if (await prisma.user.findFirst({ where: { OR: [{ email: mail }, { username: name }] }, select: { id: true } })) {
      throw conflict('Username or email already taken');
    }
    const passwordHash = await bcrypt.hash(req.body.password, config.BCRYPT_ROUNDS);
    const user = await prisma.user.create({ data: { username: name, email: mail, passwordHash, role: (await prisma.user.count()) === 0 ? 'admin' : 'user' } });
    await issue(user, res, 201);
  });

  router.post('/login', limits.auth, validate({ body: z.object({ email, password: z.string().min(1).max(128) }) }), async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    const ok = user && (await bcrypt.compare(req.body.password, user.passwordHash));
    if (!ok) throw unauthorized('Invalid email or password');
    if (!user.isActive) throw forbidden('Account is disabled');
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    await issue(user, res);
  });

  router.post('/refresh', limits.auth, validate({ body: z.object({ refreshToken: z.string().min(1).max(200) }) }), async (req, res) => {
    const hash = tokens.hash(req.body.refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hash }, include: { user: true } });
    if (!stored || stored.expiresAt < new Date()) throw unauthorized('Invalid refresh token');
    if (stored.revokedAt) {
      await prisma.refreshToken.updateMany({ where: { userId: stored.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw unauthorized('Refresh token reuse detected');
    }
    if (!stored.user.isActive) throw forbidden('Account is disabled');
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    await issue(stored.user, res);
  });

  router.post('/logout', validate({ body: z.object({ refreshToken: z.string().max(200).optional() }) }), async (req, res) => {
    if (req.body.refreshToken) {
      await prisma.refreshToken.updateMany({ where: { tokenHash: tokens.hash(req.body.refreshToken) }, data: { revokedAt: new Date() } });
    }
    res.status(204).end();
  });

  router.get('/me', auth.authenticate, (req, res) => res.json({ data: serialize.user(req.user) }));

  router.patch(
    '/me',
    auth.authenticate,
    validate({ body: z.object({ username: username.optional(), currentPassword: z.string().max(128).optional(), newPassword: password.optional() }) }),
    async (req, res) => {
      const data = {};
      if (req.body.username && req.body.username !== req.user.username) {
        if (await prisma.user.findUnique({ where: { username: req.body.username }, select: { id: true } })) throw conflict('Username already taken');
        data.username = req.body.username;
      }
      if (req.body.newPassword) {
        const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { passwordHash: true } });
        if (!req.body.currentPassword || !(await bcrypt.compare(req.body.currentPassword, current.passwordHash))) {
          throw badRequest('Current password is incorrect');
        }
        data.passwordHash = await bcrypt.hash(req.body.newPassword, config.BCRYPT_ROUNDS);
      }
      const user = await prisma.user.update({ where: { id: req.user.id }, data });
      if (data.passwordHash) await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
      res.json({ data: serialize.user(user) });
    },
  );

  return router;
}
