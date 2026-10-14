import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { unauthorized } from './errors.js';

export function createTokens(config) {
  const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

  function verify(token, secret, audience) {
    try {
      return jwt.verify(token, secret, { audience });
    } catch (err) {
      if (err.name === 'TokenExpiredError') throw unauthorized('Token expired', 'TOKEN_EXPIRED');
      throw unauthorized('Invalid token');
    }
  }

  return {
    hash: sha256,
    signAccess: (user) => jwt.sign({ sub: user.id, role: user.role }, config.JWT_SECRET, { expiresIn: config.JWT_ACCESS_TTL, audience: 'access' }),
    verifyAccess: (token) => verify(token, config.JWT_SECRET, 'access'),
    newRefresh: () => {
      const token = crypto.randomBytes(48).toString('base64url');
      return { token, hash: sha256(token), expiresAt: new Date(Date.now() + config.JWT_REFRESH_TTL_DAYS * 86_400_000) };
    },
    signTicket: (userId, purpose, ttlSec = 60) => ({
      ticket: jwt.sign({ sub: userId }, config.JWT_SECRET, { expiresIn: ttlSec, audience: `ticket:${purpose}` }),
      expiresAt: new Date(Date.now() + ttlSec * 1000).toISOString(),
    }),
    verifyTicket: (ticket, purpose) => verify(ticket, config.JWT_SECRET, `ticket:${purpose}`).sub,
  };
}

export function signStreamUrl({ baseUrl, prefix, key, secret, ttlSec, now = Date.now() }) {
  const expires = Math.floor(now / 1000) + ttlSec;
  const uri = `/${prefix}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const md5 = crypto.createHash('md5').update(`${expires}${uri} ${secret}`).digest('base64url');
  return { url: `${baseUrl}${uri}?md5=${md5}&expires=${expires}`, expiresAt: new Date(expires * 1000).toISOString() };
}
