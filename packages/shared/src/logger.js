import pino from 'pino';

export function createLogger(service) {
  return pino({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'password', 'refreshToken', 'accessToken', '*.password'],
      censor: '[redacted]',
    },
    formatters: { level: (label) => ({ level: label }) },
  });
}
