import { counter, histogram } from '@openwav/shared/metrics';
import { AppError } from '../lib/errors.js';

const httpDuration = histogram('http_request_duration_seconds', 'HTTP request latency', ['method', 'route', 'status_code']);
const httpErrors = counter('http_errors_total', 'HTTP 5xx responses', ['route']);

export function metricsMiddleware(req, res, next) {
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    const route = req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched';
    end({ method: req.method, route, status_code: res.statusCode });
    if (res.statusCode >= 500) httpErrors.inc({ route });
  });
  next();
}

export function errorHandler(logger) {
  return (err, req, res, _next) => {
    const known = err instanceof AppError;
    const status = known ? err.status : err.type === 'entity.parse.failed' ? 400 : err.status === 413 ? 413 : 500;
    if (status >= 500) (req.log ?? logger).error({ err }, 'request failed');
    res.status(status).json({
      error: {
        code: known ? err.code : status === 500 ? 'INTERNAL' : 'VALIDATION',
        message: known || status < 500 ? err.message : 'Internal server error',
        ...(known && err.details ? { details: err.details } : {}),
      },
    });
  };
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}
