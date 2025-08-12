import { server_app } from './app.js';
import {logger} from './config/logger.js';
import { connectDatabase } from './config/database.js';
import { connectRedis } from './config/redis.js';
import fs from 'fs-extra';

// const PORT = process.env.PORT || 3000;
const PORT = 3001;

async function createDirectories() {
  const directories = [
    process.env.MEDIA_STORAGE_PATH || './media',
    process.env.TEMP_DOWNLOAD_PATH || './temp',
    './logs',
    './media/audio',
    './media/video', 
    './media/covers',
    './media/thumbnails'
  ];

  for (const dir of directories) {
    try {
      await fs.ensureDir(dir);
      logger.info(`Created directory: ${dir}`);
    } catch (error) {
      logger.error(`Failed to create directory ${dir}:`, error);
    }
  }
}

async function startServer() {
  try {
    await createDirectories();
    
    await connectDatabase();
    logger.info('Database connected successfully');
    
    await connectRedis();
    logger.info('Redis connected successfully');
    
    const server = server_app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();