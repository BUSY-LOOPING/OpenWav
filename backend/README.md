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
- **Containerization**: Docker & Docker Compose

## Prerequisites

### Option 1: Docker (Recommended)
- **Docker** (v20.10 or higher)
- **Docker Compose** (v2.0 or higher)

### Option 2: Manual Installation
1. **Node.js** (v18 or higher)
2. **PostgreSQL** (v12 or higher)
3. **Redis** (v6 or higher)
4. **Python** (v3.7 or higher) with **yt-dlp**
5. **Git**

### Installing Prerequisites (Manual Setup)

#### Ubuntu/Debian
1. **Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

   sudo apt-get install -y nodejs
   ```

2. **PostgreSQL**
   ```bash
   sudo apt-get install postgresql postgresql-contrib
   ```

3. **Redis**
   ```bash
   sudo apt-get install redis-server
   ```

4. **Python and yt-dlp**
   ```bash
   sudo apt-get install python3 python3-pip
   ```


#### Windows
1. Download and install Node.js from [nodejs.org](https://nodejs.org/)
2. Download and install PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/)
3. Download and install Redis from [github.com/microsoftarchive/redis](https://github.com/microsoftarchive/redis/releases)
4. Install Python from [python.org](https://www.python.org/) and then `pip install yt-dlp`

## Installation

### Option 1: Docker Setup (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/BUSY-LOOPING/OpenWav.git
   cd OpenWav
   ```

2. **Start with Docker Compose**
   - Build and start all services
      ```bash
      docker-compose up -d
      ```

   - View logs
      ```bash
      docker-compose logs -f
      ```

   - Stop services
      ```bash
      docker-compose down
      ```

3. **Access the application**
- Backend API: http://localhost:3001
- Frontend: http://localhost:3000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

The Docker setup automatically:
- Sets up PostgreSQL database with initial schema
- Configures Redis for queue management
- Sets up the backend with proper environment variables
- Builds and runs the frontend
- Creates necessary volumes for data persistence

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

## Usage Examples

This document provides comprehensive examples of how to interact with the OpenWav Backend API using cURL commands.


### Register New User

#### Admin Registration
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Password@123",
    "username": "AdminUser"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "af30adb0-6acb-4d38-a37a-3b441b2e3a34",
      "username": "AdminUser",
      "email": "admin@example.com",
      "role": "admin",
      "createdAt": "2025-08-06T17:20:45.457Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

#### Regular User Registration
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "Password@123",
    "username": "User1"
  }'
```

### Get User Profile
```bash
curl -X GET http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Downloads

### Add Download Job
```bash
curl -X POST http://localhost:3000/api/v1/downloads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "url": "https://music.youtube.com/watch?v=p8_ugAjWI5I",
    "format": "mp3",
    "quality": "bestaudio"
  }'
```

### Get User Downloads
```bash
curl -X GET http://localhost:3000/api/v1/downloads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Get Download Details
```bash
curl -X GET http://localhost:3000/api/v1/downloads/DOWNLOAD_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Cancel Download
```bash
curl -X DELETE http://localhost:3000/api/v1/downloads/DOWNLOAD_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Get Media Info (Without Downloading)
```bash
curl -X POST http://localhost:3000/api/v1/downloads/info \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }'
```

## YouTube Integration

### Search YouTube
```bash
curl -X GET "http://localhost:3000/api/v1/youtube/search?q=Ed%20Sheeran%20Perfect" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Auto-Download from Search Query
```bash
curl -X POST http://localhost:3000/api/v1/youtube/auto-download \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "query": "Ed Sheeran Perfect",
    "format": "mp3",
    "quality": "bestaudio"
  }'
```

## Charts Integration

### Import Billboard Hot 100
```bash
curl -X POST http://localhost:3000/api/v1/charts/import/hot-100 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "date": "2024-06-01",
    "range": "1-25",
    "format": "mp3",
    "quality": "bestaudio"
  }'
```

### Get Billboard Hot 100 Chart
```bash
curl -X GET "http://localhost:3000/api/v1/charts/billboard/hot-100?date=2025-07-01&range=1-10" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Media Management

### Get Media List
```bash
curl -X GET "http://localhost:3000/api/v1/media?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Get Media Details
```bash
curl -X GET http://localhost:3000/api/v1/media/MEDIA_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Stream Media File
```bash
# Basic streaming
curl -X GET http://localhost:3000/api/v1/media/MEDIA_ID/stream \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Stream with range request support
curl -H "Range: bytes=0-1023" \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     http://localhost:3000/api/v1/media/MEDIA_ID/stream
```

### Like/Unlike Media
```bash
curl -X POST http://localhost:3000/api/v1/media/MEDIA_ID/like \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Update Watch Progress
```bash
curl -X PUT http://localhost:3000/api/v1/media/MEDIA_ID/progress \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "currentTime": 120,
    "duration": 300
  }'
```

### Get Watch History
```bash
curl -X GET http://localhost:3000/api/v1/media/history \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## User Settings

### Get User Settings
```bash
curl -X GET http://localhost:3000/api/v1/settings \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Update User Setting
```bash
curl -X PUT http://localhost:3000/api/v1/settings/theme \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "dark"}'
```

### Reset Setting to Default
```bash
curl -X DELETE http://localhost:3000/api/v1/settings/theme \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Get Detailed Preferences
```bash
curl -X GET http://localhost:3000/api/v1/settings/preferences \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Get Public Settings
```bash
curl -X GET http://localhost:3000/api/v1/settings/public \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Common Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data here
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": "Detailed error information"
  }
}
```

## Notes

- **Authentication**: Replace `YOUR_ACCESS_TOKEN` with actual tokens obtained from login/register
- **IDs**: Replace `MEDIA_ID`, `USER_ID`, `DOWNLOAD_ID` with actual resource IDs
- **Admin Operations**: Require admin role privileges
- **Token Expiration**: Tokens have expiration times - use refresh tokens when needed
- **Rate Limiting**: API may have rate limiting - check response headers
- **Error Handling**: Always check response status and handle errors appropriately

## Docker Environment

When using Docker, the API will be available at:
- **Backend**: `http://localhost:3001` (instead of 3000)
- **Database**: Accessible on `localhost:5432`
- **Redis**: Accessible on `localhost:6379`

Update your cURL commands accordingly:
```bash
# Docker example
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Password@123","username":"TestUser"}'
```


### Adding a user
```bash
```

### Adding a Download


```bash
curl -X POST http://localhost:3000/api/v1/downloads \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "quality": "bestaudio",
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

