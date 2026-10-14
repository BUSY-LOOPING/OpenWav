import { describe, expect, it } from 'vitest';
import { expiresSoon } from './api';

const jwt = (payload: object) => `h.${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.s`;

describe('expiresSoon', () => {
  const now = 1_700_000_000_000;
  it('refreshes tokens within the margin and leaves fresh or unreadable ones alone', () => {
    expect(expiresSoon(jwt({ exp: now / 1000 + 10 }), now)).toBe(true);
    expect(expiresSoon(jwt({ exp: now / 1000 - 5 }), now)).toBe(true);
    expect(expiresSoon(jwt({ exp: now / 1000 + 600 }), now)).toBe(false);
    expect(expiresSoon('not-a-jwt', now)).toBe(false);
  });
});
