# OpenWav - Backend

A comprehensive Node.js backend application for media streaming with yt-dlp integration, user authentication, admin controls, and concurrent download management.

## Features

### Core Features
- **Authentication System**: JWT-based authentication with refresh tokens
- **Role-Based Access Control**: Admin and user roles with different permissions
- **Media Streaming**: Range request support for video/audio streaming
- **yt-dlp Integration**: Download videos/audio from multiple platforms
- **Concurrent Downloads**: Configurable concurrent download management using Bull queue
- **User History Tracking**: Track watch time and playback progress
- **Like System**: Users can like/unlike media
- **Comprehensive Settings**: Both user and admin settings management

### Admin Features
- **Dashboard Statistics**: User, media, download, and storage statistics
- **User Management**: Create, update, delete users
- **Download Management**: Monitor and control download tasks
- **Concurrent Download Control**: Adjust number of concurrent downloads
- **Global Settings**: Configure system-wide settings
- **Queue Monitoring**: Real-time download queue status

### User Features
- **Personal Settings**: Theme, quality preferences, playback settings
- **Watch History**: Track and resume playback
- **Media Library**: Browse and search downloaded media
- **Progress Tracking**: Resume videos where you left off

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL with connection pooling
- **Queue System**: Bull (Redis-based) for download management
- **Authentication**: JWT with refresh tokens
- **Media Processing**: yt-dlp for downloading
- **File Storage**: Organized directory structure
- **Logging**: Winston for comprehensive logging

## Prerequisites

Before setting up the application, ensure you have the following installed:

1. **Node.js** (v18 or higher)
2. **PostgreSQL** (v12 or higher)
3. **Redis** (v6 or higher)
4. **Python** (v3.7 or higher) with **yt-dlp**
5. **Git**

### Installing Prerequisites

#### Ubuntu/Debian
```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Redis
sudo apt-get install redis-server

# Python and yt-dlp
sudo apt-get install python3 python3-pip
pip3 install yt-dlp
```

#### macOS (using Homebrew)
```bash
# Node.js
brew install node

# PostgreSQL
brew install postgresql
brew services start postgresql

# Redis
brew install redis
brew services start redis

# Python and yt-dlp
brew install python3
pip3 install yt-dlp
```

#### Windows
1. Download and install Node.js from [nodejs.org](https://nodejs.org/)
2. Download and install PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/)
3. Download and install Redis from [github.com/microsoftarchive/redis](https://github.com/microsoftarchive/redis/releases)
4. Install Python from [python.org](https://www.python.org/) and then `pip install yt-dlp`

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd media-streaming-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit the `.env` file with your configuration:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=media_streaming
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password

   # JWT Configuration
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_REFRESH_SECRET=your_refresh_token_secret

   # Admin Configuration (for first-time setup)
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=admin123

   # Redis Configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379

   # Other settings...
   ```

4. **Set up PostgreSQL database**
   ```bash
   # Create database user (run as postgres user)
   sudo -u postgres createuser --interactive your_db_user
   sudo -u postgres createdb media_streaming

   # Or use psql
   sudo -u postgres psql
   CREATE USER your_db_user WITH PASSWORD 'your_db_password';
   CREATE DATABASE media_streaming OWNER your_db_user;
   GRANT ALL PRIVILEGES ON DATABASE media_streaming TO your_db_user;
   \q
   ```

5. **Run database setup**
   ```bash
   npm run setup-db
   ```

6. **Start the application**
   ```bash
   # Development mode with auto-reload
   npm run dev

   # Production mode
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - User logout
- `GET /api/v1/auth/profile` - Get user profile

### Media
- `GET /api/v1/media` - Get media list with pagination
- `GET /api/v1/media/:id` - Get media details
- `GET /api/v1/media/:id/stream` - Stream media file
- `POST /api/v1/media/:id/like` - Toggle like/unlike
- `PUT /api/v1/media/:id/progress` - Update watch progress
- `GET /api/v1/media/history` - Get watch history

### Downloads
- `POST /api/v1/downloads` - Add download job
- `GET /api/v1/downloads` - Get user's downloads
- `GET /api/v1/downloads/:id` - Get download details
- `DELETE /api/v1/downloads/:id` - Cancel download
- `POST /api/v1/downloads/info` - Get media info without downloading

### Settings
- `GET /api/v1/settings` - Get user settings
- `PUT /api/v1/settings/:key` - Update user setting
- `DELETE /api/v1/settings/:key` - Reset setting to default
- `GET /api/v1/settings/preferences` - Get detailed preferences
- `GET /api/v1/settings/public` - Get public settings

### Admin (Admin Only)
- `GET /api/v1/admin/dashboard` - Dashboard statistics
- `GET /api/v1/admin/users` - Get all users
- `PUT /api/v1/admin/users/:id` - Update user
- `DELETE /api/v1/admin/users/:id` - Delete user
- `GET /api/v1/admin/downloads` - Get all download tasks
- `DELETE /api/v1/admin/downloads/:id` - Cancel download task
- `PUT /api/v1/admin/concurrent` - Update concurrent downloads
- `GET /api/v1/admin/settings` - Get global settings
- `PUT /api/v1/admin/settings/:key` - Update global setting

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `media_streaming` |
| `DB_USER` | Database user | Required |
| `DB_PASSWORD` | Database password | Required |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_EXPIRES_IN` | JWT expiration time | `24h` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `CONCURRENT_DOWNLOADS` | Default concurrent downloads | `3` |
| `MAX_CONCURRENT_DOWNLOADS` | Maximum concurrent downloads | `10` |
| `MEDIA_STORAGE_PATH` | Media files directory | `./media` |
| `TEMP_DOWNLOAD_PATH` | Temporary download directory | `./temp` |

### Directory Structure

The application creates the following directory structure:

```
media-streaming-app/
├── media/
│   ├── audio/          # Audio files
│   ├── video/          # Video files
│   ├── thumbnails/     # Thumbnail images
│   └── covers/         # Cover images
├── temp/               # Temporary downloads
├── logs/               # Application logs
└── ...
```

## Usage Examples

### Adding a Download

```bash
curl -X POST http://localhost:3000/api/v1/downloads \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "quality": "720p",
    "format": "mp4"
  }'
```

### Streaming Media

```bash
# Stream with range request support
curl -H "Range: bytes=0-1023" \
  http://localhost:3000/api/v1/media/MEDIA_ID/stream
```

### Updating User Settings

```bash
curl -X PUT http://localhost:3000/api/v1/settings/theme \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "dark"}'
```

## Development

### Project Structure

```
src/
├── config/         # Configuration files
├── controllers/    # Request handlers
├── middleware/     # Express middleware
├── models/         # Database models (queries)
├── routes/         # API route definitions
├── services/       # Business logic services
├── utils/          # Utility functions
└── workers/        # Background job workers
```

### Running in Development Mode

```bash
# Install development dependencies
npm install

# Start with auto-reload
npm run dev

# Run database migrations
npm run migrate

# Create admin user
npm run create-admin
```

### Logging

The application uses Winston for logging with different levels:
- `error`: Error messages
- `warn`: Warning messages
- `info`: General information
- `debug`: Debug information

Logs are written to both console and log files in the `logs/` directory.

## Production Deployment

### Using PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start application with PM2
pm2 start src/server.js --name "media-streaming-app"

# Enable startup script
pm2 startup
pm2 save
```

### Environment Setup

1. Set `NODE_ENV=production`
2. Use strong secrets for JWT tokens
3. Configure proper database credentials
4. Set up reverse proxy (nginx/Apache)
5. Enable SSL/TLS
6. Configure proper file permissions
7. Set up log rotation

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running
   - Verify credentials in `.env`
   - Ensure database exists

2. **Redis Connection Failed**
   - Check Redis is running
   - Verify Redis configuration
   - Check firewall settings

3. **yt-dlp Not Found**
   - Install: `pip3 install yt-dlp`
   - Update PATH if needed
   - Set `YTDLP_PATH` in `.env`

4. **Permission Denied for Media Files**
   - Check directory permissions
   - Ensure Node.js can write to media directories

5. **JWT Token Issues**
   - Check JWT_SECRET is set
   - Verify token format in requests
   - Check token expiration

### Logs

Check application logs for detailed error information:

```bash
# View recent logs
tail -f logs/app.log

# View error logs only
grep "ERROR" logs/app.log
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the API documentation