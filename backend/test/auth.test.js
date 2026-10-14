import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp, createUser, prisma, resetDb } from './helpers.js';

let ctx;
beforeEach(async () => {
  await resetDb();
  ctx = buildApp();
});

const register = (body) => ctx.request.post('/api/v1/auth/register').send({ username: 'alice', email: 'Alice@Example.com', password: 'hunter22x', ...body });

describe('auth', () => {
  it('registers, normalises email, and makes only the first user an admin', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ username: 'alice', email: 'alice@example.com', role: 'admin' });
    expect((await register({ username: 'bob', email: 'bob@example.com' })).body.data.user.role).toBe('user');
    expect(res.body.data.tokens.accessToken).toBeTruthy();
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('rejects weak passwords and duplicates', async () => {
    expect((await register({ password: 'short' })).status).toBe(400);
    expect((await register({ password: 'onlyletters' })).body.error.code).toBe('VALIDATION');
    await register();
    expect((await register({ email: 'other@example.com' })).status).toBe(409);
  });

  it('honours the registration setting', async () => {
    await prisma.setting.create({ data: { key: 'auth.registration_enabled', value: false } });
    expect((await register()).status).toBe(403);
  });

  it('logs in and returns a generic error for bad credentials', async () => {
    await register();
    expect((await ctx.request.post('/api/v1/auth/login').send({ email: 'alice@example.com', password: 'hunter22x' })).status).toBe(200);
    const bad = await ctx.request.post('/api/v1/auth/login').send({ email: 'alice@example.com', password: 'nope' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.message).toBe('Invalid email or password');
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const { tokens } = (await register()).body.data;
    const first = await ctx.request.post('/api/v1/auth/refresh').send({ refreshToken: tokens.refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.data.tokens.refreshToken).not.toBe(tokens.refreshToken);
    const reuse = await ctx.request.post('/api/v1/auth/refresh').send({ refreshToken: tokens.refreshToken });
    expect(reuse.status).toBe(401);
    const afterReuse = await ctx.request.post('/api/v1/auth/refresh').send({ refreshToken: first.body.data.tokens.refreshToken });
    expect(afterReuse.status).toBe(401);
  });

  it('reports expired access tokens with TOKEN_EXPIRED so clients refresh', async () => {
    const user = await createUser();
    const expired = (await import('jsonwebtoken')).default.sign({ sub: user.id }, ctx.external.config.JWT_SECRET, { expiresIn: -10, audience: 'access' });
    const res = await ctx.request.get('/api/v1/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('blocks banned users', async () => {
    const user = await createUser({ isActive: false });
    const res = await ctx.request.post('/api/v1/auth/login').send({ email: user.email, password: 'secret123' });
    expect(res.status).toBe(403);
  });

  it('changes the password only with the current one and revokes sessions', async () => {
    const { tokens } = (await register()).body.data;
    const auth = { Authorization: `Bearer ${tokens.accessToken}` };
    expect((await ctx.request.patch('/api/v1/auth/me').set(auth).send({ currentPassword: 'wrong', newPassword: 'newpass123' })).status).toBe(400);
    expect((await ctx.request.patch('/api/v1/auth/me').set(auth).send({ currentPassword: 'hunter22x', newPassword: 'newpass123' })).status).toBe(200);
    expect((await ctx.request.post('/api/v1/auth/refresh').send({ refreshToken: tokens.refreshToken })).status).toBe(401);
  });

  it('rate limits auth endpoints using the configured limit', async () => {
    await prisma.setting.create({ data: { key: 'ratelimit.auth_per_15min', value: 2 } });
    ctx.deps.settings.invalidate();
    const attempt = () => ctx.request.post('/api/v1/auth/login').send({ email: 'x@y.io', password: 'whatever1' });
    await attempt();
    await attempt();
    const limited = await attempt();
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  });
});
