import winston from 'winston';
import path from 'path';

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

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(info => {
    const { timestamp, level, message, stack, ...meta } = info;
    let log = `${timestamp} [${level}]: ${message}`;
    if (stack) log += `\n${stack}`;
    if (Object.keys(meta).length > 0) log += `\n${JSON.stringify(meta, null, 2)}`;
    return log;
  })
);

const transports = [];

transports.push(
  new winston.transports.Console({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: consoleFormat,
    handleExceptions: true,
    handleRejections: true
  })
);

if (process.env.NODE_ENV === 'production' || process.env.LOG_FILE_PATH) {
  const logFilePath = process.env.LOG_FILE_PATH || path.join(process.cwd(), 'logs', 'scheduler.log');
  const errorLogPath = path.join(path.dirname(logFilePath), 'scheduler.error.log');

  transports.push(
    new winston.transports.File({
      filename: logFilePath,
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      maxsize: 5242880,
      maxFiles: 5,
      handleExceptions: true,
      handleRejections: true
    })
  );

  transports.push(
    new winston.transports.File({
      filename: errorLogPath,
      level: 'error',
      format: logFormat,
      maxsize: 5242880,
      maxFiles: 5,
      handleExceptions: true,
      handleRejections: true
    })
  );
}

const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: logFormat,
  transports,
  exceptionHandlers: transports,
  rejectionHandlers: transports,
  exitOnError: false
});

logger.cron = (jobName, message, meta = {}) => {
  logger.info(`[CRON] [${jobName}] ${message}`, meta);
};

logger.cronError = (jobName, error, meta = {}) => {
  logger.error(`[CRON] [${jobName}] ${error.message}`, {
    stack: error.stack,
    ...meta
  });
};

logger.job = (jobName, message, meta = {}) => {
  logger.debug(`[JOB] [${jobName}] ${message}`, meta);
};

logger.jobResult = (jobName, affected, meta = {}) => {
  logger.info(`[JOB] [${jobName}] Completed — ${affected} record(s) affected`, meta);
};

logger.startup = () => {
  logger.info('='.repeat(60));
  logger.info('Scheduler Service Starting');
  logger.info('='.repeat(60));
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Log Level: ${logger.level}`);
  logger.info(`Node.js Version: ${process.version}`);
  logger.info(`Process ID: ${process.pid}`);
  logger.info('='.repeat(60));
};

logger.shutdown = () => {
  logger.info('='.repeat(60));
  logger.info('Scheduler Service Shutting Down');
  logger.info('='.repeat(60));
};

logger.logError = (error, additionalInfo = {}) => {
  logger.error('Unhandled error', {
    message: error.message,
    stack: error.stack,
    code: error.code,
    name: error.name,
    ...additionalInfo
  });
};

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    message: error.message,
    stack: error.stack,
    code: error.code,
    name: error.name
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString()
  });
});

export { logger };