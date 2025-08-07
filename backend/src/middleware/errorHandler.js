import {logger} from '../config/logger.js';

function errorHandler(err, req, res, next) {
  logger.error({
    url: req.originalUrl,
    method: req.method,
    status: err.status || 500,
    message: err.message,
    stack: err.stack,
    user: req.user ? req.user.id : null
  });

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
}

export default errorHandler;