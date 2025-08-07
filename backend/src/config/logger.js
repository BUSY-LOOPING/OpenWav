import winston from 'winston';
import path from 'path';


// Define log levels and colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

winston.addColors(logColors);

// Create log directory if it doesn't exist
const logDir = path.join(process.cwd(), 'logs');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(info => {
    const { timestamp, level, message, stack, ...meta } = info;
    let log = `${timestamp} [${level}]: ${message}`;
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Create transports array
const transports = [];

// Console transport (always enabled)
transports.push(
  new winston.transports.Console({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: consoleFormat,
    handleExceptions: true,
    handleRejections: true
  })
);

// File transports (only in production or when LOG_FILE_PATH is set)
if (process.env.NODE_ENV === 'production' || process.env.LOG_FILE_PATH) {
  const logFilePath = process.env.LOG_FILE_PATH || path.join(logDir, 'app.log');
  const errorLogPath = path.join(path.dirname(logFilePath), 'error.log');

  // All logs file
  transports.push(
    new winston.transports.File({
      filename: logFilePath,
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      handleExceptions: true,
      handleRejections: true
    })
  );

  // Error logs file
  transports.push(
    new winston.transports.File({
      filename: errorLogPath,
      level: 'error',
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      handleExceptions: true,
      handleRejections: true
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: logFormat,
  transports,
  exceptionHandlers: transports,
  rejectionHandlers: transports,
  exitOnError: false
});

// Stream for Morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// Add custom logging methods
logger.database = (message, meta = {}) => {
  logger.debug(`[DATABASE] ${message}`, meta);
};

logger.auth = (message, meta = {}) => {
  logger.info(`[AUTH] ${message}`, meta);
};

logger.download = (message, meta = {}) => {
  logger.info(`[DOWNLOAD] ${message}`, meta);
};

logger.media = (message, meta = {}) => {
  logger.info(`[MEDIA] ${message}`, meta);
};

logger.admin = (message, meta = {}) => {
  logger.warn(`[ADMIN] ${message}`, meta);
};

logger.security = (message, meta = {}) => {
  logger.warn(`[SECURITY] ${message}`, meta);
};

// Performance logging
logger.performance = (message, duration, meta = {}) => {
  logger.debug(`[PERFORMANCE] ${message} (${duration}ms)`, meta);
};

// Request logging helper
logger.request = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;
    
    const logLevel = statusCode >= 400 ? 'warn' : 'info';
    
    logger[logLevel](`${method} ${originalUrl}`, {
      method,
      url: originalUrl,
      statusCode,
      ip,
      userAgent: req.get('User-Agent'),
      duration: `${duration}ms`,
      userId: req.user?.id,
      username: req.user?.username
    });
  });
  
  next();
};

// Error logging helper
logger.logError = (error, req = null, additionalInfo = {}) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    code: error.code,
    name: error.name,
    ...additionalInfo
  };

  if (req) {
    errorInfo.request = {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      username: req.user?.username,
      body: req.method !== 'GET' ? req.body : undefined,
      query: req.query,
      params: req.params
    };
  }

  logger.error('Application error:', errorInfo);
};

// Startup logging
logger.startup = () => {
  logger.info('='.repeat(60));
  logger.info('🚀 Media Streaming Application Starting');
  logger.info('='.repeat(60));
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Log Level: ${logger.level}`);
  logger.info(`Node.js Version: ${process.version}`);
  logger.info(`Process ID: ${process.pid}`);
  
  if (process.env.NODE_ENV === 'production') {
    logger.info(`Log Files: ${process.env.LOG_FILE_PATH || path.join(logDir, 'app.log')}`);
  }
  
  logger.info('='.repeat(60));
};

// Shutdown logging
logger.shutdown = () => {
  logger.info('='.repeat(60));
  logger.info('🛑 Media Streaming Application Shutting Down');
  logger.info('='.repeat(60));
};

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', {
    message: error.message,
    stack: error.stack,
    code: error.code,
    name: error.name
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString()
  });
});

export {logger};