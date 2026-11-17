import { z } from 'zod';
import { badRequest } from './errors.js';

export function validate(schemas) {
  return (req, _res, next) => {
    for (const [source, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[source]);
      if (!result.success) {
        return next(badRequest(result.error.issues[0].message, result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))));
      }
      Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true, enumerable: true });
    }
    next();
  };
}

export const uuidParam = z.object({ id: z.string().uuid() });

export const pageQuery = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function encodeCursor(row, field = 'createdAt') {
  const value = row[field];
  return Buffer.from(JSON.stringify([value instanceof Date ? value.toISOString() : value, row.id, value instanceof Date])).toString('base64url');
}

export function decodeCursor(cursor) {
  try {
    const [value, id, isDate = true] = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (typeof id !== 'string') throw new Error('bad cursor');
    return { value: isDate ? new Date(value) : value, id };
  } catch {
    throw badRequest('Invalid cursor');
  }
}

export function cursorWhere(cursor, field = 'createdAt', dir = 'desc') {
  if (!cursor) return {};
  const { value, id } = decodeCursor(cursor);
  const op = dir === 'asc' ? 'gt' : 'lt';
  return { OR: [{ [field]: { [op]: value } }, { [field]: value, id: { [op]: id } }] };
}

export function page(rows, limit, field = 'createdAt') {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? encodeCursor(items.at(-1), field) : null };
}
