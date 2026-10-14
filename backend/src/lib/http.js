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
  return Buffer.from(JSON.stringify([row[field].toISOString(), row.id])).toString('base64url');
}

export function cursorWhere(cursor, field = 'createdAt') {
  if (!cursor) return {};
  try {
    const [at, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    const date = new Date(at);
    return { OR: [{ [field]: { lt: date } }, { [field]: date, id: { lt: id } }] };
  } catch {
    throw badRequest('Invalid cursor');
  }
}

export function page(rows, limit, field = 'createdAt') {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? encodeCursor(items.at(-1), field) : null };
}
