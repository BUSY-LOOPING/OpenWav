export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(400, 'VALIDATION', message, details);
export const unauthorized = (message = 'Authentication required', code = 'UNAUTHORIZED') => new AppError(401, code, message);
export const forbidden = (message = 'Forbidden') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (message) => new AppError(409, 'CONFLICT', message);
export const unavailable = (message) => new AppError(503, 'UNAVAILABLE', message);
