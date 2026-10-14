import { forbidden, unauthorized } from '../lib/errors.js';

export function createAuth({ prisma, tokens }) {
  async function resolveUser(req) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    const { sub } = tokens.verifyAccess(header.slice(7));
    const user = await prisma.user.findUnique({ where: { id: sub }, select: { id: true, username: true, email: true, role: true, isActive: true, createdAt: true } });
    if (!user) throw unauthorized('Invalid token');
    if (!user.isActive) throw forbidden('Account is disabled');
    return user;
  }

  return {
    authenticate: async (req, _res, next) => {
      req.user = await resolveUser(req);
      if (!req.user) throw unauthorized();
      next();
    },
    optionalAuth: async (req, _res, next) => {
      req.user = await resolveUser(req).catch(() => null);
      next();
    },
    requireAdmin: (req, _res, next) => {
      if (req.user?.role !== 'admin') throw forbidden('Admin only');
      next();
    },
  };
}
